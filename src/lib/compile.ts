import * as ts from 'typescript'
import extend = require('xtend')
import has = require('has')
import Promise = require('any-promise')
import { join, relative, basename } from 'path'
import { DependencyTree, Overrides, Emitter } from '../interfaces'
import { readFileFrom } from '../utils/fs'
import { EOL, normalizeEOL } from '../utils/path'
import {
  resolveFrom,
  relativeTo,
  isHttp,
  isModuleName,
  normalizeSlashes,
  pathFromDefinition,
  normalizeToDefinition,
  toDefinition
} from '../utils/path'
import { REFERENCE_REGEXP } from '../utils/references'
import { PROJECT_NAME, DEPENDENCY_SEPARATOR } from '../utils/config'
import TypingsError from './error'

/**
 * Options interface. Supply a name and the current working directory.
 */
export interface Options {
  cwd: string
  name: string
  ambient: boolean
  meta: boolean
  emitter: Emitter
}

/**
 * The compiled output data.
 */
export interface CompiledOutput {
  name: string
  tree: DependencyTree
  main: string
  browser: string
}

/**
 * Compile a dependency tree using a root name.
 */
export default function compile (tree: DependencyTree, options: Options): Promise<CompiledOutput> {
  const { name } = options
  const readFiles: ts.Map<Promise<string>> = {}

  if (tree.ambient && !options.ambient) {
    return Promise.reject(new TypingsError(
      `Unable to compile "${options.name}", the typings are meant to be installed as ` +
      `ambient but attempted to be compiled as an external module`
    ))
  }

  // Re-use "reads" over all compilations, created separate "imported" instances.
  return Promise.all([
    compileDependencyTree(tree, extend(options, {
      browser: false,
      readFiles,
      imported: {} as ts.Map<boolean>
    })),
    compileDependencyTree(tree, extend(options, {
      browser: true,
      readFiles,
      imported: {} as ts.Map<boolean>
    }))
  ])
    .then(([main, browser]) => {
      return {
        name,
        tree,
        main,
        browser
      }
    })
}

/**
 * Extends the default options with different compilation settings.
 */
interface CompileOptions extends Options {
  browser: boolean
  readFiles: ts.Map<Promise<string>>
  imported: ts.Map<boolean>
  name: string
  emitter: Emitter
}

/**
 * Resolve override paths.
 */
function resolveFromOverride (src: string, to: string | boolean, tree: DependencyTree): string {
  if (typeof to === 'string') {
    if (isModuleName(to)) {
      const [moduleName, modulePath] = getModuleNameParts(to, tree)

      return modulePath ? normalizeToDefinition(to) : moduleName
    }

    return resolveFrom(src, normalizeToDefinition(to))
  }

  return to ? src : undefined
}

/**
 * Resolve module locations (appending `.d.ts` to paths).
 */
function resolveFromWithModuleName (src: string, to: string, tree: DependencyTree): string {
  if (isModuleName(to)) {
    const [moduleName, modulePath] = getModuleNameParts(to, tree)

    return modulePath ? toDefinition(to) : moduleName
  }

  return resolveFrom(src, toDefinition(to))
}

/**
 * Get stringify options for a dependency.
 */
function getStringifyOptions (
  tree: DependencyTree,
  options: CompileOptions,
  parent: StringifyOptions
): StringifyOptions {
  const overrides: Overrides = {}
  const isTypings = typeof tree.typings === 'string'
  const main = isTypings ? tree.typings : tree.main
  const browser = isTypings ? tree.browserTypings : tree.browser

  if (options.browser && browser) {
    if (typeof browser === 'string') {
      const mainDefinition = resolveFrom(tree.src, normalizeToDefinition(main))
      const browserDefinition = resolveFrom(tree.src, normalizeToDefinition(browser))

      overrides[mainDefinition] = browserDefinition
    } else {
      for (const key of Object.keys(browser)) {
        const from = resolveFromOverride(tree.src, key, tree) as string
        const to = resolveFromOverride(tree.src, browser[key], tree)

        overrides[from] = to
      }
    }
  }

  const referenced: ts.Map<boolean> = {}
  const dependencies: ts.Map<StringifyOptions> = {}
  const entry = main == null ? main : resolveFrom(tree.src, normalizeToDefinition(main))
  const prefix = `${parent ? parent.prefix : ''}${DEPENDENCY_SEPARATOR}${options.name}`

  return extend(options, {
    tree,
    entry,
    prefix,
    isTypings,
    overrides,
    referenced,
    dependencies,
    parent
  })
}

/**
 * Compile a dependency tree to a single definition.
 */
function compileDependencyTree (tree: DependencyTree, options: CompileOptions): Promise<string> {
  const stringifyOptions = getStringifyOptions(tree, options, undefined)
  const contents: Array<Promise<string>> = []

  if (Array.isArray(tree.files)) {
    for (const file of tree.files) {
      contents.push(compileDependencyPath(file, stringifyOptions))
    }
  }

  // Supports only having `files` specified.
  if (stringifyOptions.entry || contents.length === 0) {
    contents.push(compileDependencyPath(null, stringifyOptions))
  }

  return Promise.all(contents).then(out => out.join(EOL))
}

/**
 * Compile a dependency for a path, with pre-created stringify options.
 */
function compileDependencyPath (path: string, options: StringifyOptions): Promise<string> {
  const { tree, entry } = options

  // Fallback to resolving the entry file.
  if (path == null) {
    if (entry == null) {
      return Promise.reject(new TypingsError(
        `Unable to resolve entry ".d.ts" file for "${options.name}", ` +
        'please make sure the module has a main or typings field'
      ))
    }

    return stringifyDependencyPath(resolveFrom(tree.src, entry), options)
  }

  return stringifyDependencyPath(resolveFrom(tree.src, path), options)
}

/**
 * Stringify options extend the compiler options.
 */
interface StringifyOptions extends CompileOptions {
  entry: string
  prefix: string
  isTypings: boolean
  overrides: Overrides
  referenced: ts.Map<boolean>
  dependencies: ts.Map<StringifyOptions>
  tree: DependencyTree
  parent: StringifyOptions
}

/**
 * Read a file with a backup cache object.
 */
function cachedReadFileFrom (path: string, options: StringifyOptions) {
  if (!has(options.readFiles, path)) {
    options.readFiles[path] = readFileFrom(path)
  }

  return options.readFiles[path]
}

/**
 * Return cached stringify options from the current options object.
 */
function cachedStringifyOptions (name: string, compileOptions: CompileOptions, options: StringifyOptions) {
  const tree = getDependency(name, options)

  if (!has(options.dependencies, name)) {
    if (tree) {
      options.dependencies[name] = getStringifyOptions(tree, compileOptions, options)
    } else {
      options.dependencies[name] = null
    }
  }

  return options.dependencies[name]
}

/**
 * Get possible path and dependency overrides.
 */
function getPath (path: string, options: StringifyOptions) {
  if (has(options.overrides, path)) {
    return options.overrides[path]
  }

  return path
}

/**
 * Get dependency from stringify options.
 */
function getDependency (name: string, options: StringifyOptions): DependencyTree {
  const { tree, overrides } = options

  if (has(overrides, name)) {
    if (overrides[name]) {
      return tree.dependencies[overrides[name] as string]
    }
  } else if (has(tree.dependencies, name)) {
    return tree.dependencies[name]
  }
}

/**
 * Stringify a dependency file.
 */
function stringifyDependencyPath (path: string, options: StringifyOptions): Promise<string> {
  const resolved = getPath(path, options)
  const { tree, ambient, cwd, browser, name, readFiles, imported, meta, entry, emitter } = options
  const importedPath = importPath(path, pathFromDefinition(path), options)

  // Return `null` to skip the dependency writing, could have the same import twice.
  if (has(options.imported, importedPath)) {
    return Promise.resolve<string>(null)
  }

  // Set the file to "already imported" to avoid duplication.
  options.imported[importedPath] = true

  // Emit compile events for progression.
  emitter.emit('compile', { name, path, tree, browser })

  // Load a dependency path.
  function loadByModuleName (path: string) {
    const [moduleName, modulePath] = getModuleNameParts(path, tree)
    const compileOptions = { cwd, browser, readFiles, imported, emitter, name: moduleName, ambient: false, meta }
    const stringifyOptions = cachedStringifyOptions(moduleName, compileOptions, options)

    // When no options are returned, the dependency is missing.
    if (!stringifyOptions) {
      return Promise.resolve<string>(null)
    }

    return compileDependencyPath(modulePath, stringifyOptions)
  }

  // Check if the path is resolving to a module name before reading.
  if (isModuleName(resolved)) {
    return loadByModuleName(resolved)
  }

  return cachedReadFileFrom(resolved, options)
    .then(
      function (rawContents) {
        const info = ts.preProcessFile(rawContents)

        // Skip output of lib files.
        if (info.isLibFile) {
          return
        }

        const importedFiles = info.importedFiles.map(x => resolveFromWithModuleName(resolved, x.fileName, tree))
        const referencedFiles = info.referencedFiles.map(x => resolveFrom(resolved, x.fileName))

        // All dependencies MUST be imported for ambient modules.
        if (ambient) {
          Object.keys(tree.dependencies).forEach(x => importedFiles.push(x))
        }

        const imports = importedFiles.map(importedFile => {
          const path = getPath(importedFile, options)

          if (isModuleName(path)) {
            return loadByModuleName(path)
          }

          return stringifyDependencyPath(path, options)
        })

        return Promise.all(imports)
          .then<string>(imports => {
            const stringified = stringifyFile(resolved, rawContents, path, options)

            for (const reference of referencedFiles) {
              emitter.emit('reference', { name, path, reference, tree, browser })
            }

            const out = imports.filter(x => x != null)
            out.push(stringified)
            const contents = out.join(EOL)

            emitter.emit('compiled', { name, path, tree, browser, contents })

            return contents
          })
      },
      function (cause) {
        const authorPhrase = options.parent ? `The author of "${options.parent.name}" needs to` : 'You should'
        const relativePath = relativeTo(tree.src, resolved)

        // Provide better errors for the entry path.
        if (path === entry) {
          return Promise.reject(new TypingsError(
            `Unable to read typings for "${options.name}". ` +
            `${authorPhrase} check the entry paths in "${basename(tree.src)}" are up to date`,
            cause
          ))
        }

        return Promise.reject(new TypingsError(
          `Unable to read "${relativePath}" from "${options.name}". ` +
          `${authorPhrase} validate all import paths are accurate (case sensitive and relative)`,
          cause
        ))
      }
    )
}

/**
 * Separate the module name into pieces.
 */
function getModuleNameParts (name: string, tree: DependencyTree): [string, string] {
  const parts = name.split(/[\\\/]/g)
  let len = parts.length

  while (len--) {
    const name = parts.slice(0, len).join('/')
    const path = parts.slice(len).join('/')

    if (tree.dependencies[name]) {
      return [name, path]
    }
  }

  return [parts.join('/'), null]
}

/**
 * Normalize import paths against the prefix.
 */
function importPath (path: string, name: string, options: StringifyOptions) {
  const { prefix, tree } = options
  const resolved = getPath(resolveFromWithModuleName(path, name, tree), options)

  if (isModuleName(resolved)) {
    const [moduleName, modulePath] = getModuleNameParts(resolved, tree)

    // If the dependency is not available, *do not* transform - it's probably ambient.
    if (tree.dependencies[moduleName] == null) {
      return name
    }

    return `${prefix}${DEPENDENCY_SEPARATOR}${modulePath ? pathFromDefinition(resolved) : resolved}`
  }

  const relativePath = relativeTo(tree.src, pathFromDefinition(resolved))

  return normalizeSlashes(join(prefix, relativePath))
}

/**
 * Stringify a dependency file contents.
 */
function stringifyFile (path: string, rawContents: string, rawPath: string, options: StringifyOptions) {
  const contents = rawContents.replace(REFERENCE_REGEXP, '')
  const sourceFile = ts.createSourceFile(path, contents, ts.ScriptTarget.Latest, true)
  const { tree, name, prefix, parent, isTypings, cwd, ambient, entry } = options

  // Output information for the original type source.
  const source = isHttp(path) ? path : normalizeSlashes(relative(cwd, path))
  const meta = options.meta ? `// Generated by ${PROJECT_NAME}${EOL}// Source: ${source}${EOL}` : ''

  if (ambient) {
    if ((sourceFile as any).externalModuleIndicator) {
      throw new TypingsError(
        `Attempted to compile "${name}" as an ambient ` +
        `module, but it looks like an external module.`
      )
    }

    return `${meta}${normalizeEOL(contents.trim(), EOL)}`
  }

  let wasDeclared = false
  let hasExports = false
  let hasDefaultExport = false
  let hasExportEquals = false

  // Custom replacer function to rewrite the file.
  function replacer (node: ts.Node) {
    // Flag `export =` as the main re-definition needs to be written different.
    if (node.kind === ts.SyntaxKind.ExportAssignment) {
      hasDefaultExport = !(node as ts.ExportAssignment).isExportEquals
      hasExportEquals = !hasDefaultExport
    } else if (node.kind === ts.SyntaxKind.ExportDeclaration) {
      hasExports = true
    } else {
      hasExports = hasExports || !!(node.flags & ts.NodeFlags.Export)
      hasDefaultExport = hasDefaultExport || !!(node.flags & ts.NodeFlags.Default)
    }

    if (
      node.kind === ts.SyntaxKind.StringLiteral &&
      (
        node.parent.kind === ts.SyntaxKind.ExportDeclaration ||
        node.parent.kind === ts.SyntaxKind.ImportDeclaration ||
        node.parent.kind === ts.SyntaxKind.ModuleDeclaration
      )
    ) {
      return ` '${importPath(path, (<ts.StringLiteral> node).text, options)}'`
    }

    if (node.kind === ts.SyntaxKind.DeclareKeyword) {
      // Notify the reader to remove leading trivia.
      wasDeclared = true

      return sourceFile.text.slice(node.getFullStart(), node.getStart())
    }

    if (node.kind === ts.SyntaxKind.ExternalModuleReference) {
      const requirePath = importPath(path, (node as any).expression.text, options)

      return ` require('${requirePath}')`
    }
  }

  // Read through the file.
  function read (start: number, end: number) {
    const text = sourceFile.text.slice(start, end)

    // Trim leading whitespace.
    if (start === 0) {
      return text.replace(/^\s+$/, '')
    }

    // Trim trailing whitespace.
    if (end == null) {
      return text.replace(/\s+$/, '')
    }

    // Remove leading whitespace from the statement after "declare".
    if (wasDeclared) {
      wasDeclared = false

      return text.replace(/^\s+/, '')
    }

    return text
  }

  // Create an alias/proxy module namespace to expose the implementation.
  function alias (name: string) {
    const imports: string[] = []

    if (hasExportEquals) {
      imports.push(`import main = require('${modulePath}');`)
      imports.push(`export = main;`)
    } else {
      if (hasExports) {
        imports.push(`export * from '${modulePath}';`)
      }

      if (hasDefaultExport) {
        imports.push(`export { default } from '${modulePath}';`)
      }
    }

    // No aliases, nothing exported.
    if (imports.length === 0) {
      return ''
    }

    return declareText(name, imports.join(EOL))
  }

  const isEntry = rawPath === entry
  const moduleText = normalizeEOL(processTree(sourceFile, replacer, read), EOL)
  const moduleName = parent && parent.ambient ? name : prefix

  // Direct usage of definition/typings. This is *not* a psuedo-module.
  if (isEntry && isTypings) {
    return meta + declareText(parent ? moduleName : name, moduleText)
  }

  const modulePath = importPath(path, pathFromDefinition(path), options)
  const prettyPath = normalizeSlashes(join(name, relativeTo(tree.src, pathFromDefinition(path))))
  const declared = declareText(modulePath, moduleText)

  if (!isEntry) {
    return meta + declared + (parent ? '' : alias(prettyPath))
  }

  return meta + declared + (parent ? '' : alias(prettyPath)) + alias(parent ? moduleName : name)
}

/**
 * Declare a module.
 */
function declareText (name: string, text: string) {
  return `declare module '${name}' {${text ? EOL + text + EOL : ''}}${EOL}`
}

/**
 * Rewrite TypeScript source files.
 *
 * Original Source: https://github.com/SitePen/dts-generator/blob/22402351ffd953bf32344a0e48f2ba073fc5b65a/index.ts#L70-L101
 */
function processTree (
  sourceFile: ts.SourceFile,
  replacer: (node: ts.Node) => string,
  reader: (start: number, end?: number) => string
): string {
  let code = ''
  let position = 0

  function skip (node: ts.Node) {
    position = node.end
  }

  function readThrough (node: ts.Node) {
    if (node.pos > position) {
      code += reader(position, node.pos)
      position = node.pos
    }
  }

  function visit (node: ts.Node) {
    readThrough(node)

    const replacement = replacer(node)

    if (replacement != null) {
      code += replacement
      skip(node)
    } else {
      ts.forEachChild(node, visit)
    }
  }

  visit(sourceFile)

  code += reader(position)

  return code
}
