import * as ts from 'typescript'
import extend = require('xtend')
import has = require('has')
import Promise = require('any-promise')
import { EOL } from 'os'
import { join, relative } from 'path'
import { DependencyTree, Overrides, Emitter } from '../interfaces'
import { readFileFrom } from '../utils/fs'
import { resolveFrom, relativeTo, isHttp, isModuleName, normalizeSlashes, fromDefinition, normalizeToDefinition, toDefinition } from '../utils/path'
import { REFERENCE_REGEXP } from '../utils/references'
import { PROJECT_NAME, CONFIG_FILE, DEPENDENCY_SEPARATOR } from '../utils/config'
import { resolveDependency } from '../utils/parse'
import { VERSION } from '../typings'
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
  tree: DependencyTree
  main: string
  browser: string
}

/**
 * Compile a dependency tree using a root name.
 */
export default function compile (tree: DependencyTree, options: Options): Promise<CompiledOutput> {
  const readFiles: ts.Map<Promise<string>> = {}

  return Promise.all([
    compileDependencyTree(tree, extend(options, { browser: false, readFiles })),
    compileDependencyTree(tree, extend(options, { browser: true, readFiles }))
  ])
    .then(([main, browser]) => {
      return {
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
  name: string
}

/**
 * Resolve override paths.
 */
function resolveFromWithModuleNameOverride (src: string, to: string | boolean): string {
  if (typeof to === 'string') {
    if (isModuleName(to)) {
      const [moduleName, modulePath] = getModuleNameParts(to)

      return modulePath ? normalizeToDefinition(to) : moduleName
    }

    return resolveFrom(src, normalizeToDefinition(to))
  }

  return to ? src : undefined
}

/**
 * Resolve modules and paths.
 */
function resolveFromWithModuleNamePath (src: string, to: string): string {
  return isModuleName(to) ? to : resolveFrom(src, to)
}

/**
 * Resolve module locations (appending `.d.ts` to paths).
 */
function resolveFromWithModuleName (src: string, to: string): string {
  if (isModuleName(to)) {
    const [moduleName, modulePath] = getModuleNameParts(to)

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
        const from = resolveFromWithModuleNameOverride(tree.src, key) as string
        const to = resolveFromWithModuleNameOverride(tree.src, browser[key])

        overrides[from] = to
      }
    }
  }

  const imported: ts.Map<boolean> = {}
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
    imported,
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
  imported: ts.Map<boolean>
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
  const { tree, ambient, cwd, browser, name, readFiles, meta, entry, emitter } = options
  const { raw, src } = tree

  // Load a dependency path.
  function loadByModuleName (path: string) {
    const [moduleName, modulePath] = getModuleNameParts(path)
    const compileOptions = { cwd, browser, readFiles, emitter, name: moduleName, ambient: false, meta }
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

        const importedFiles = info.importedFiles.map(x => resolveFromWithModuleName(resolved, x.fileName))
        const referencedFiles = info.referencedFiles.map(x => resolveFrom(resolved, x.fileName))
        const moduleAugmentations = (info.ambientExternalModules || []).map(x => resolveFromWithModuleName(resolved, x))
        const ambientModules = moduleAugmentations.filter(x => importedFiles.indexOf(x) === -1)

        if (ambientModules.length && !ambient) {
          return Promise.reject(new TypingsError(
            `Attempted to compile "${options.name}" as a dependency, but ` +
            `it contains some ambient module declarations ` +
            `(${ambientModules.map(JSON.stringify).join(', ')}).`
          ))
        }

        // All dependencies MUST be imported for ambient modules.
        if (ambient) {
          Object.keys(tree.dependencies).forEach(x => importedFiles.push(x))
        }

        const imports = importedFiles.map(importedFile => {
          const path = getPath(importedFile, options)

          // Return `null` to skip the dependency writing, could have the same import twice.
          if (has(options.imported, path)) {
            return
          }

          // Support inline ambient module declarations.
          if (ambientModules.indexOf(path) > -1) {
            return
          }

          // Set the file to "already imported" to avoid duplication.
          options.imported[path] = true

          if (isModuleName(path)) {
            return loadByModuleName(path)
          }

          return stringifyDependencyPath(path, options)
        })

        return Promise.all(imports)
          .then<string>(imports => {
            const stringified = stringifyFile(resolved, rawContents, path, options)

            for (const path of referencedFiles) {
              emitter.emit('reference', { name, path, raw, src })
            }

            const contents = imports.filter(x => x != null)

            // Push the current file at the end of the contents.
            // This builds the stringified file with dependencies first.
            contents.push(stringified)

            return contents.join(EOL)
          })
      },
      function (cause) {
        const authorPhrase = options.parent ? `The author of "${options.parent.name}" needs to` : 'You should'
        const relativePath = relativeTo(tree.src, resolved)

        // Provide better errors for the entry path.
        if (path === entry) {
          return Promise.reject(new TypingsError(
            `Unable to read typings for "${options.name}". ` +
            `${authorPhrase} check the path is correct`,
            cause
          ))
        }

        return Promise.reject(new TypingsError(
          `Unable to read "${relativePath}" from "${options.name}". ` +
          `${authorPhrase} check the entry in "${CONFIG_FILE}" is correct`,
          cause
        ))
      }
    )
}

/**
 * Separate the module name into pieces.
 */
function getModuleNameParts (name: string): [string, string] {
  const parts = name.split(/[\\\/]/)
  const moduleName = parts.shift()
  const modulePath = parts.length === 0 ? null : parts.join('/')

  return [moduleName, modulePath]
}

/**
 * Normalize import paths against the prefix.
 */
function importPath (path: string, name: string, options: StringifyOptions) {
  const resolved = getPath(resolveFromWithModuleName(path, name), options)
  const { prefix, tree } = options

  if (isModuleName(resolved)) {
    const [moduleName, modulePath] = getModuleNameParts(resolved)

    // If the dependency is not available, *do not* transform - it's probably ambient.
    if (options.dependencies[moduleName] == null) {
      return name
    }

    return `${prefix}${DEPENDENCY_SEPARATOR}${modulePath ? fromDefinition(resolved) : resolved}`
  }

  const relativePath = relativeTo(tree.src, fromDefinition(resolved))

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
  const source = isHttp(path) ? path : relative(cwd, path)
  const meta = options.meta ? `// Generated by ${PROJECT_NAME}${EOL}// Source: ${source}${EOL}` : ''

  if (ambient) {
    if ((sourceFile as any).externalModuleIndicator) {
      throw new TypingsError(
        `Attempted to compile "${name}" as an ambient ` +
        `module, but it looks like an external module.`
      )
    }

    return `${meta}${contents.trim()}`
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
  const moduleText = processTree(sourceFile, replacer, read)
  const moduleName = parent && parent.ambient ? name : prefix

  // Direct usage of definition/typings. This is *not* a psuedo-module.
  if (isEntry && isTypings) {
    return meta + declareText(parent ? moduleName : name, moduleText)
  }

  const modulePath = importPath(path, fromDefinition(path), options)
  const prettyPath = normalizeSlashes(join(name, relativeTo(tree.src, fromDefinition(path))))
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
