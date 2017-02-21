import * as ts from 'typescript'
import extend = require('xtend')
import has = require('has')
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
  appendToPath
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
  global: boolean
  meta: boolean
  emitter: Emitter
}

/**
 * Result of compiling multiple resolutions.
 */
export interface ResolutionResult {
  main?: string
  browser?: string
  [name: string]: string
}

/**
 * The compiled output data.
 */
export interface CompileResult {
  cwd: string
  name: string
  tree: DependencyTree
  results: ResolutionResult
  global: boolean
}

/**
 * Compile a dependency tree using a root name.
 */
export function compile (tree: DependencyTree, resolutions: string[], options: Options): Promise<CompileResult> {
  const { name, cwd, global } = options
  const fileCache: ts.MapLike<Promise<string>> = {}

  // Ensure the global installation is valid.
  if (tree.global && !global) {
    return Promise.reject(new TypingsError(
      `Unable to compile "${name}", the typings are meant to be installed as ` +
      `global but attempted to be compiled as an external module`
    ))
  }

  // Ensure the resolution is a valid target.
  for (const resolution of resolutions) {
    if (resolution !== 'main' && resolution !== 'browser') {
      return Promise.reject(new TypingsError(
        `Unable to resolve using "${resolution}" setting`
      ))
    }
  }

  return Promise.all(resolutions.map(resolution => {
    const resolved: ts.MapLike<string> = {}
    const imported: ts.MapLike<Promise<ModuleInfo>> = {}

    return compileDependencyTree(tree, extend(options, {
      resolution,
      fileCache,
      imported,
      resolved
    }))
  }))
    .then((output) => {
      const results: ResolutionResult = {}

      for (let i = 0; i < output.length; i++) {
        results[resolutions[i]] = output[i]
      }

      return {
        cwd,
        name,
        tree,
        global,
        results
      }
    })
}

/**
 * Extends the default options with different compilation settings.
 */
interface CompileOptions extends Options {
  resolution: string
  fileCache: ts.MapLike<Promise<string>>
  resolved: ts.MapLike<string>
  imported: ts.MapLike<Promise<ModuleInfo>>
  emitter: Emitter
}

/**
 * Resolve import.
 */
function resolveImportFrom (from: string, to: string) {
  return isModuleName(to) ? to : resolveFrom(from, to)
}

/**
 * Resolve override paths.
 */
function resolveOverride (src: string, to: string | boolean, tree: DependencyTree): string {
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

  if (options.resolution === 'browser' && browser) {
    if (typeof browser === 'string') {
      const mainDefinition = resolveFrom(tree.src, normalizeToDefinition(main))
      const browserDefinition = resolveFrom(tree.src, normalizeToDefinition(browser))

      overrides[mainDefinition] = browserDefinition
    } else {
      for (const key of Object.keys(browser)) {
        const from = resolveOverride(tree.src, key, tree) as string
        const to = resolveOverride(tree.src, browser[key], tree)

        overrides[from] = to
      }
    }
  }

  const referenced: ts.MapLike<boolean> = {}
  const dependencies: ts.MapLike<StringifyOptions> = {}
  const entry = main == null ? undefined : normalizeToDefinition(main)
  const prefix = `${parent ? parent.prefix : ''}${DEPENDENCY_SEPARATOR}${options.name}`

  return extend(options, {
    tree,
    entry,
    prefix,
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
  const { name, global, resolution } = options

  options.emitter.emit('compiledependency', { tree, global, name, resolution })

  if (Array.isArray(tree.files)) {
    for (const file of tree.files) {
      contents.push(stringifyDependencyImport(resolveFrom(tree.src, file), DependencyImport.ALL_PATHS, false, stringifyOptions))
    }
  }

  if (stringifyOptions.entry) {
    contents.push(stringifyDependencyImport(resolveFrom(tree.src, stringifyOptions.entry), DependencyImport.ALL_PATHS, true, stringifyOptions))
  }

  if (contents.length === 0) {
    contents.push(stringifyDependencyImport(resolveFrom(tree.src, 'index.d.ts'), DependencyImport.DEFAULT_ONLY, true, stringifyOptions))
  }

  return Promise.all(contents).then(out => out.join(EOL))
}

/**
 * Stringify options extend the compiler options.
 */
interface StringifyOptions extends CompileOptions {
  entry: string
  prefix: string
  overrides: Overrides
  referenced: ts.MapLike<boolean>
  dependencies: ts.MapLike<StringifyOptions>
  tree: DependencyTree
  parent: StringifyOptions
}

/**
 * Read a file with a backup cache object.
 */
function cachedReadFileFrom (path: string, options: StringifyOptions) {
  if (!has(options.fileCache, path)) {
    options.fileCache[path] = readFileFrom(path)
  }

  return options.fileCache[path]
}

/**
 * Return cached stringify options from the current options object.
 */
function cachedStringifyOptions (name: string, compileOptions: CompileOptions, options: StringifyOptions) {
  if (!has(options.dependencies, name)) {
    const branch = options.tree.dependencies[name]

    if (branch) {
      options.dependencies[name] = getStringifyOptions(branch, compileOptions, options)
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
 * Track options per-file.
 */
interface ModuleInfo {
  parent?: ModuleInfo
  path: string
  originalPath: string
  isEntry: boolean
  options: StringifyOptions
  sourceFile: ts.SourceFile
  fileInfo: ts.PreProcessedFileInfo
}

enum DependencyImport {
  DEFAULT_ONLY,
  SUFFIXES_ONLY,
  ALL_PATHS
}

/**
 * Try to resolve a dependency import.
 */
function readDependencyImport (originalPath: string, mode: DependencyImport, isEntry: boolean, options: StringifyOptions, parent?: ModuleInfo) {
  const paths: string[] = []
  const { cwd, tree, resolution, fileCache, resolved, imported, emitter, meta } = options

  // Handle various file loading situations effeciently.
  if (mode === DependencyImport.DEFAULT_ONLY || mode === DependencyImport.ALL_PATHS) {
    paths.push(originalPath)
  }

  if (mode === DependencyImport.SUFFIXES_ONLY || mode === DependencyImport.ALL_PATHS) {
    paths.push(appendToPath(originalPath, '.d.ts'), appendToPath(originalPath, '/index.d.ts'))
  }

  // Make an attempt at compiling the raw path and mapping module imports.
  function attempt (cause: Error, index: number): Promise<ModuleInfo | null> {
    // Skip future resolution attempts.
    if (index >= paths.length) {
      const authorPhrase = options.parent ? `The author of "${options.parent.name}" needs to` : 'You should'
      const relativePath = isModuleName(originalPath) ? originalPath : relativeTo(options.tree.src, originalPath)

      if (isEntry) {
        return Promise.reject(new TypingsError(
          `Unable to read typings for "${options.name}". ` +
          `${authorPhrase} check the entry paths in "${basename(options.tree.src)}" are up to date`,
          cause
        ))
      }

      return Promise.reject(new TypingsError(
        `Unable to read "${relativePath}" from "${options.name}". ` +
        `${authorPhrase} validate all import paths are accurate (case sensitive and relative)`,
        cause
      ))
    }

    const path = getPath(paths[index], options)

    if (isModuleName(path)) {
      const [moduleName, modulePath] = getModuleNameParts(path, tree)

      const childOptions = cachedStringifyOptions(moduleName, {
        cwd,
        resolution,
        fileCache,
        emitter,
        imported,
        resolved,
        name: moduleName,
        global: false,
        meta
      }, options)

      // When no options are returned, the dependency is missing and should be ignored.
      if (!childOptions) {
        return Promise.resolve(null)
      }

      if (modulePath) {
        return readDependencyImport(resolveFrom(childOptions.tree.src, modulePath), DependencyImport.SUFFIXES_ONLY, false, childOptions, parent)
      }

      if (childOptions.entry) {
        return readDependencyImport(resolveFrom(childOptions.tree.src, childOptions.entry), DependencyImport.ALL_PATHS, true, childOptions, parent)
      }

      return readDependencyImport(resolveFrom(childOptions.tree.src, 'index.d.ts'), DependencyImport.DEFAULT_ONLY, true, childOptions, parent)
    }

    // Avoid rendering the same file twice.
    if (options.imported[path]) {
      return options.imported[path].then(() => null)
    }

    return options.imported[path] = readFileFrom(path).then(
      function (contents) {
        const fileInfo = ts.preProcessFile(contents)
        const sourceFile = ts.createSourceFile(path, contents.replace(REFERENCE_REGEXP, ''), ts.ScriptTarget.Latest, true)
        const moduleInfo: ModuleInfo = { path, originalPath, isEntry, parent, sourceFile, options, fileInfo }

        return moduleInfo
      },
      function (err) {
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EISDIR' || err.code === 'EINVALIDSTATUS') {
          return attempt(err, index + 1)
        }

        return Promise.reject(err)
      }
    )
  }

  return attempt(null, 0).then(function (moduleInfo) {
    if (moduleInfo) {
      options.resolved[getCachePath(originalPath, options, false)] = getCachePath(moduleInfo.path, moduleInfo.options, true)
    }

    return moduleInfo
  })
}

/**
 * Return the path for the module.
 */
function getCachePath (originalPath: string, options: StringifyOptions, strip: boolean) {
  const path = strip ? pathFromDefinition(originalPath) : originalPath

  if (isModuleName(path)) {
    return normalizeSlashes(`${options.prefix}${DEPENDENCY_SEPARATOR}${path}`)
  }

  return normalizeSlashes(join(options.prefix, relativeTo(options.tree.src, path)))
}

/**
 * Try to stringify a dependency import.
 */
function stringifyDependencyImport (importPath: string, mode: DependencyImport, isEntry: boolean, options: StringifyOptions, parent?: ModuleInfo) {
  return readDependencyImport(importPath, mode, isEntry, options, parent)
    .then(function (info) {
      return info ? stringifyDependencyPath(info) : undefined
    })
}

/**
 * Stringify a dependency file.
 */
function stringifyDependencyPath (moduleInfo: ModuleInfo): Promise<string> {
  const { path, options, sourceFile, fileInfo } = moduleInfo
  const { tree, global, resolution, name, prefix, emitter } = options

  // Emit compile events for progression.
  emitter.emit('compile', { name, prefix, path, tree, resolution })

  const importedFiles = fileInfo.importedFiles.map(x => resolveImportFrom(path, x.fileName))
  const referencedFiles = fileInfo.referencedFiles.map(x => resolveFrom(path, x.fileName))

  // All dependencies MUST be imported for global modules.
  if (global) {
    Object.keys(tree.dependencies).forEach(x => importedFiles.push(x))
  }

  const imports = importedFiles.map(importedFile => {
    const mode = isModuleName(importedFile) ? DependencyImport.DEFAULT_ONLY : DependencyImport.SUFFIXES_ONLY

    return stringifyDependencyImport(importedFile, mode, false, options, moduleInfo)
  })

  return Promise.all(imports).then(imports => {
    const stringified = stringifyModuleFile(moduleInfo)

    for (const reference of referencedFiles) {
      emitter.emit('reference', { name, prefix, path, reference, tree, resolution })
    }

    const contents = imports.filter(x => x != null).concat(stringified).join(EOL)

    emitter.emit('compiled', { name, prefix, path, tree, resolution, contents })

    return contents
  })
}

/**
 * Separate the module name into pieces.
 */
function getModuleNameParts (name: string, tree: DependencyTree): [string, string] {
  const parts = name.split(/[\\\/]/g)
  let len = parts.length

  while (len) {
    len--

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
function getImportPath (path: string, options: StringifyOptions) {
  return options.resolved[getCachePath(path, options, false)] || path
}

/**
 * Stringify a dependency file contents.
 */
function stringifyModuleFile (info: ModuleInfo) {
  const { options } = info
  const { tree, name, prefix, parent, cwd, global } = options

  // Output information for the original type source.
  const source = isHttp(info.path) ? info.path : normalizeSlashes(relative(cwd, info.path))
  const meta = options.meta ? `// Generated by ${PROJECT_NAME}${EOL}// Source: ${source}${EOL}` : ''

  if (global) {
    if (ts.isExternalModule(info.sourceFile)) {
      throw new TypingsError(
        `Attempted to compile "${name}" as a global ` +
        `module, but it looks like an external module. ` +
        `You'll need to remove the global option to continue.`
      )
    }

    return `${meta}${normalizeEOL(info.sourceFile.getText().trim(), EOL)}${EOL}`
  } else {
    if (!ts.isExternalModule(info.sourceFile) && !(info.parent && ts.isExternalModule(info.parent.sourceFile))) {
      throw new TypingsError(
        `Attempted to compile "${name}" as an external module, ` +
        `but it looks like a global module. ` +
        `You'll need to enable the global option to continue.`
      )
    }
  }

  let hasExports = false
  let hasDefaultExport = false
  let hasExportEquals = false
  let hasLocalImports = false
  let wasDeclared = false

  // Custom replacer function to rewrite the file.
  function replacer (node: ts.Node) {
    // Flag `export =` as the main re-definition needs to be written different.
    if (node.kind === ts.SyntaxKind.ExportAssignment) {
      hasDefaultExport = !(node as ts.ExportAssignment).isExportEquals
      hasExportEquals = !hasDefaultExport
    } else if (node.kind === ts.SyntaxKind.ExportDeclaration) {
      hasExports = true
    } else if (node.kind === ts.SyntaxKind.ExportSpecifier) {
      hasDefaultExport = hasDefaultExport || (node as ts.ExportSpecifier).name.getText() === 'default'
    }

    const flags = ts.getCombinedModifierFlags(node)

    hasExports = hasExports || !!(flags & ts.ModifierFlags.Export)
    hasDefaultExport = hasDefaultExport || !!(flags & ts.ModifierFlags.Default)

    if (
      node.kind === ts.SyntaxKind.StringLiteral &&
      (
        node.parent.kind === ts.SyntaxKind.ExportDeclaration ||
        node.parent.kind === ts.SyntaxKind.ImportDeclaration ||
        node.parent.kind === ts.SyntaxKind.ModuleDeclaration
      )
    ) {
      hasLocalImports = hasLocalImports || !isModuleName((node as ts.StringLiteral).text)

      return ` '${getImportPath(resolveImportFrom(info.path, (node as ts.StringLiteral).text), options)}'`
    }

    if (node.kind === ts.SyntaxKind.DeclareKeyword) {
      // Notify the reader to remove leading trivia.
      wasDeclared = true

      return info.sourceFile.text.slice(node.getFullStart(), node.getStart())
    }

    if (node.kind === ts.SyntaxKind.ExternalModuleReference) {
      const requirePath = getImportPath(resolveImportFrom(info.path, (node as any).expression.text), options)

      return ` require('${requirePath}')`
    }
  }

  // Read through the file.
  function read (start: number, end: number) {
    const text = info.sourceFile.text.slice(start, end)

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

  const moduleText = normalizeEOL(processTree(info.sourceFile, replacer, read), EOL)
  const modulePath = getImportPath(info.originalPath, options)
  const moduleName = parent && parent.global ? name : modulePath

  // Direct usage of definition/typings. This is *not* a psuedo-module.
  if (info.isEntry && !hasLocalImports) {
    return meta + declareText(parent ? moduleName : name, moduleText)
  }

  const prettyPath = normalizeSlashes(join(name, relativeTo(tree.src, pathFromDefinition(info.path))))
  const declared = declareText(modulePath, moduleText)

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

  if (info.isEntry && !parent) {
    return meta + declared + alias(prettyPath) + alias(name)
  }

  return meta + declared + (parent ? '' : alias(prettyPath))
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
 * Reference: https://github.com/SitePen/dts-generator/blob/22402351ffd953bf32344a0e48f2ba073fc5b65a/index.ts#L70-L101
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
