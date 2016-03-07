import extend = require('xtend')
import invariant = require('invariant')
import zipObject = require('zip-object')
import Promise = require('any-promise')
import { resolve, dirname, join } from 'path'
import { resolve as resolveUrl } from 'url'
import { readJson, readConfigFrom, readJsonFrom } from '../utils/fs'
import { parseDependency } from '../utils/parse'
import { findUp, findConfigFile } from '../utils/find'
import { isDefinition, isHttp } from '../utils/path'
import { CONFIG_FILE, PROJECT_NAME } from '../utils/config'
import { Dependency, DependencyBranch, DependencyTree, Emitter } from '../interfaces'
import TypingsError from './error'

/**
 * Default dependency config options.
 */
const DEFAULT_DEPENDENCY: DependencyTree = {
  src: undefined,
  raw: undefined,
  main: undefined,
  browser: undefined,
  typings: undefined,
  browserTypings: undefined,
  version: undefined,
  files: undefined,
  dependencies: {},
  devDependencies: {},
  peerDependencies: {},
  ambientDependencies: {},
  ambientDevDependencies: {}
}

/**
 * Options for resolving dependencies.
 */
export interface Options {
  cwd: string
  emitter: Emitter
  dev?: boolean
  peer?: boolean
  ambient?: boolean
}

/**
 * Resolve all dependencies at the current path.
 */
export function resolveAllDependencies (options: Options): Promise<DependencyTree> {
  return Promise.all([
    resolveBowerDependencies(options).catch(() => extend(DEFAULT_DEPENDENCY)),
    resolveNpmDependencies(options).catch(() => extend(DEFAULT_DEPENDENCY)),
    resolveTypeDependencies(options).catch(() => extend(DEFAULT_DEPENDENCY))
  ])
    .then((trees) => mergeDependencies(DEFAULT_DEPENDENCY, ...trees))
}

/**
 * Resolve a single dependency object.
 */
export function resolveDependency (dependency: Dependency, options: Options, parent?: DependencyTree): Promise<DependencyTree> {
  const { type, location, raw } = dependency

  if (type === 'registry') {
    return resolveDependencyRegistry(dependency, options, parent)
  }

  return resolveDependencyInternally(type, location, raw, options, parent)
}

/**
 * Internal version of `resolveDependency`, skipping the registry handling.
 */
function resolveDependencyInternally (type: string, location: string, raw: string, options: Options, parent?: DependencyTree) {
  if (type === 'npm') {
    return resolveNpmDependency(location, raw, options, parent)
  }

  if (type === 'bower') {
    return resolveBowerDependency(location, raw, options, parent)
  }

  return resolveFileDependency(location, raw, options, parent)
}

/**
 * Resolving a registry dependency has an intermediate step.
 */
function resolveDependencyRegistry (dependency: Dependency, options: Options, parent?: DependencyTree) {
  const { location, meta } = dependency

  return readJsonFrom(location)
    .then(entry => {
      // Rewrite dependency type and location, but recreate `raw`.
      const { type, location } = parseDependency(entry.location)
      const raw = `registry:${meta.source}/${meta.name}#${entry.tag}`

      return resolveDependencyInternally(type, location, raw, options, parent)
    })
}

/**
 * Resolve a dependency in NPM.
 */
function resolveNpmDependency (name: string, raw: string, options: Options, parent?: DependencyTree) {
  return findUp(options.cwd, join('node_modules', name))
    .then(
      function (modulePath: string) {
        if (isDefinition(modulePath)) {
          return resolveFileDependency(modulePath, raw, options, parent)
        }

        return resolveNpmDependencyFrom(modulePath, raw, options, parent)
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, parent))
      }
    )
}

/**
 * Resolve a dependency in Bower.
 */
function resolveBowerDependency (name: string, raw: string, options: Options, parent?: DependencyTree) {
  return resolveBowerComponentPath(options.cwd)
    .then(
      function (componentPath: string) {
        const modulePath = resolve(componentPath, name)

        if (isDefinition(modulePath)) {
          return resolveFileDependency(modulePath, raw, options, parent)
        }

        return resolveBowerDependencyFrom(modulePath, raw, componentPath, options, parent)
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, parent))
      }
    )
}

/**
 * Resolve a local file dependency.
 */
function resolveFileDependency (location: string, raw: string, options: Options, parent?: DependencyTree): Promise<DependencyTree> {
  let src: string

  if (isHttp(location)) {
    src = location
  } else if (parent && isHttp(parent.src)) {
    src = resolveUrl(parent.src, location)
  } else {
    src = resolve(options.cwd, location)
  }

  if (!isDefinition(src)) {
    return resolveTypeDependencyFrom(src, raw, options, parent)
  }

  options.emitter.emit('resolve', { src, raw, parent })

  const tree: DependencyTree = extend(DEFAULT_DEPENDENCY, {
    typings: src,
    src,
    raw,
    parent
  })

  options.emitter.emit('resolved', { src, tree, raw, parent })

  // Resolve direct typings using `typings` property.
  return Promise.resolve(tree)
}

/**
 * Follow and resolve bower dependencies.
 */
export function resolveBowerDependencies (options: Options): Promise<DependencyTree> {
  return findUp(options.cwd, 'bower.json')
    .then(
      function (bowerJsonPath: string) {
        return resolveBowerComponentPath(dirname(bowerJsonPath))
          .then(function (componentPath: string) {
            return resolveBowerDependencyFrom(bowerJsonPath, undefined, componentPath, options)
          })
      },
      function (cause) {
        return Promise.reject(new TypingsError(`Unable to resolve Bower dependencies`, cause))
      }
    )
}

/**
 * Resolve bower dependencies from a path.
 */
function resolveBowerDependencyFrom (
  src: string,
  raw: string,
  componentPath: string,
  options: Options,
  parent?: DependencyTree
): Promise<DependencyTree> {
  checkCircularDependency(parent, src)

  options.emitter.emit('resolve', { src, raw, parent })

  return readJson(src)
    .then(
      function (bowerJson: any = {}) {
        const tree = extend(DEFAULT_DEPENDENCY, {
          name: bowerJson.name,
          version: bowerJson.version,
          main: bowerJson.main,
          browser: bowerJson.browser,
          typings: bowerJson.typings,
          browserTypings: bowerJson.browserTypings,
          src,
          raw,
          parent
        })

        const dependencyMap = extend(bowerJson.dependencies)
        const devDependencyMap = extend(options.dev ? bowerJson.devDependencies : {})

        return Promise.all([
          resolveBowerDependencyMap(componentPath, dependencyMap, options, tree),
          resolveBowerDependencyMap(componentPath, devDependencyMap, options, tree),
          maybeResolveTypeDependencyFrom(join(src, '..', CONFIG_FILE), raw, options, parent)
        ])
          .then(function ([dependencies, devDependencies, typedPackage]) {
            tree.dependencies = dependencies
            tree.devDependencies = devDependencies

            options.emitter.emit('resolved', { src, tree, raw, parent })

            return mergeDependencies(tree, typedPackage)
          })
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, parent))
      }
    )
}

/**
 * Resolve the path to bower components.
 */
function resolveBowerComponentPath (path: string): Promise<string> {
  return readJson(resolve(path, '.bowerrc'))
    .then(
      function (bowerrc: any = {}) {
        return resolve(path, bowerrc.directory || 'bower_components')
      },
      function () {
        return resolve(path, 'bower_components')
      }
    )
}

/**
 * Recursively resolve dependencies from a list and component path.
 */
function resolveBowerDependencyMap (
  componentPath: string,
  dependencies: any,
  options: Options,
  parent: DependencyTree
): Promise<DependencyBranch> {
  const keys = Object.keys(dependencies)
  const { cwd, emitter } = options

  return Promise.all(keys.map(function (name) {
    const modulePath = resolve(componentPath, name, 'bower.json')
    const resolveOptions: Options = { dev: false, ambient: false, peer: false, cwd, emitter }

    return resolveBowerDependencyFrom(modulePath, `bower:${name}`, componentPath, resolveOptions, parent)
  }))
    .then(results => zipObject(keys, results))
}

/**
 * Follow and resolve npm dependencies.
 */
export function resolveNpmDependencies (options: Options): Promise<DependencyTree> {
  return findUp(options.cwd, 'package.json')
    .then(
      function (packgeJsonPath: string) {
        return resolveNpmDependencyFrom(packgeJsonPath, undefined, options)
      },
      function (cause) {
        return Promise.reject(new TypingsError(`Unable to resolve NPM dependencies`, cause))
      }
    )
}

/**
 * Resolve NPM dependencies from `package.json`.
 */
function resolveNpmDependencyFrom (src: string, raw: string, options: Options, parent?: DependencyTree): Promise<DependencyTree> {
  checkCircularDependency(parent, src)

  options.emitter.emit('resolve', { src, raw, parent })

  return readJson(src)
    .then(
      function (packageJson: any = {}) {
        const tree = extend(DEFAULT_DEPENDENCY, {
          name: packageJson.name,
          version: packageJson.version,
          main: packageJson.main,
          browser: packageJson.browser,
          typings: packageJson.typings,
          browserTypings: packageJson.browserTypings,
          src,
          raw,
          parent
        })

        const dependencyMap = extend(packageJson.dependencies)
        const devDependencyMap = extend(options.dev ? packageJson.devDependencies : {})
        const peerDependencyMap = extend(options.peer ? packageJson.peerDependencies : {})

        return Promise.all([
          resolveNpmDependencyMap(src, dependencyMap, options, tree),
          resolveNpmDependencyMap(src, devDependencyMap, options, tree),
          resolveNpmDependencyMap(src, peerDependencyMap, options, tree),
          maybeResolveTypeDependencyFrom(join(src, '..', CONFIG_FILE), raw, options, parent)
        ])
          .then(function ([dependencies, devDependencies, peerDependencies, typedPackage]) {
            tree.dependencies = dependencies
            tree.devDependencies = devDependencies
            tree.peerDependencies = peerDependencies

            options.emitter.emit('resolved', { src, tree, raw, parent })

            return mergeDependencies(tree, typedPackage)
          })
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, parent))
      }
    )
}

/**
 * Recursively resolve dependencies from a list and component path.
 */
function resolveNpmDependencyMap (src: string, dependencies: any, options: Options, parent: DependencyTree): Promise<DependencyBranch> {
  const cwd = dirname(src)
  const keys = Object.keys(dependencies)

  return Promise.all(keys.map(function (name) {
    const resolveOptions: Options = { dev: false, peer: false, ambient: false, cwd, emitter: options.emitter }

    return resolveNpmDependency(join(name, 'package.json'), `npm:${name}`, resolveOptions, parent)
  }))
    .then(results => zipObject(keys, results))
}

/**
 * Follow and resolve type dependencies.
 */
export function resolveTypeDependencies (options: Options): Promise<DependencyTree> {
  return findConfigFile(options.cwd)
    .then(
      function (path: string) {
        return resolveTypeDependencyFrom(path, undefined, options)
      },
      function (cause) {
        return Promise.reject(new TypingsError(`Unable to resolve Typings dependencies`, cause))
      }
    )
}

/**
 * Resolve type dependencies from an exact path.
 */
function resolveTypeDependencyFrom (src: string, raw: string, options: Options, parent?: DependencyTree) {
  checkCircularDependency(parent, src)

  options.emitter.emit('resolve', { src, raw, parent })

  return readConfigFrom(src)
    .then<DependencyTree>(
      function (config) {
        const tree = extend(DEFAULT_DEPENDENCY, {
          name: config.name,
          main: config.main,
          version: config.version,
          browser: config.browser,
          typings: config.typings,
          browserTypings: config.browserTypings,
          files: Array.isArray(config.files) ? config.files : undefined,
          type: PROJECT_NAME,
          src,
          raw,
          parent
        })

        const { ambient, dev, peer } = options

        const dependencyMap = extend(config.dependencies)
        const devDependencyMap = extend(dev ? config.devDependencies : {})
        const peerDependencyMap = extend(peer ? config.peerDependencies : {})
        const ambientDependencyMap = extend(ambient ? config.ambientDependencies : {})
        const ambientDevDependencyMap = extend(ambient && dev ? config.ambientDevDependencies : {})

        return Promise.all([
          resolveTypeDependencyMap(src, dependencyMap, options, tree),
          resolveTypeDependencyMap(src, devDependencyMap, options, tree),
          resolveTypeDependencyMap(src, peerDependencyMap, options, tree),
          resolveTypeDependencyMap(src, ambientDependencyMap, options, tree),
          resolveTypeDependencyMap(src, ambientDevDependencyMap, options, tree),
        ])
          .then(function ([dependencies, devDependencies, peerDependencies, ambientDependencies, ambientDevDependencies]) {
            tree.dependencies = dependencies
            tree.devDependencies = devDependencies
            tree.peerDependencies = peerDependencies
            tree.ambientDependencies = ambientDependencies
            tree.ambientDevDependencies = ambientDevDependencies

            options.emitter.emit('resolved', { src, tree, raw, parent })

            return tree
          })
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, parent))
      }
    )
}

/**
 * Resolve type dependency ignoring not found issues (E.g. when mixed resolve NPM/Bower).
 */
function maybeResolveTypeDependencyFrom (src: string, raw: string, options: Options, parent?: DependencyTree) {
  return resolveTypeDependencyFrom(src, raw, options, parent).catch(() => extend(DEFAULT_DEPENDENCY))
}

/**
 * Resolve type dependency map from a cache directory.
 */
function resolveTypeDependencyMap (src: string, dependencies: any, options: Options, parent: DependencyTree) {
  const cwd = dirname(src)
  const keys = Object.keys(dependencies)

  return Promise.all(keys.map(function (name) {
    const resolveOptions: Options = { dev: false, ambient: false, peer: false, cwd, emitter: options.emitter }

    return resolveDependency(parseDependency(dependencies[name]), resolveOptions, parent)
  }))
    .then(results => zipObject(keys, results))
}

/**
 * Check whether the filename is a circular dependency.
 */
function checkCircularDependency (tree: DependencyTree, filename: string) {
  if (tree) {
    const currentSrc = tree.src

    do {
      invariant(tree.src !== filename, `Circular dependency detected using "${currentSrc}"`)
    } while (tree = tree.parent)
  }
}

/**
 * Create a resolved failure error message.
 */
function resolveError (raw: string, cause: Error, parent?: DependencyTree) {
  let message = `Unable to resolve ${raw == null ? 'typings' : `"${raw}"`}`

  if (parent != null && parent.raw != null) {
    message += ` from "${parent.raw}"`
  }

  return new TypingsError(message, cause)
}

/**
 * Merge dependency trees together.
 */
function mergeDependencies (root: DependencyTree, ...trees: DependencyTree[]): DependencyTree {
  const dependency = extend(root)

  for (const tree of trees) {
    // Skip empty dependency trees.
    if (tree == null) {
      continue
    }

    const { name, raw, src, main, browser, typings, browserTypings, parent, files } = tree

    // The parent needs to always be set.
    if (parent != null) {
      dependency.parent = parent
    }

    if (typeof name === 'string') {
      dependency.name = name
    }

    if (typeof raw === 'string') {
      dependency.raw = raw
    }

    // Handle `main` and `typings` overrides all together.
    if (main != null || browser != null || typings != null || browserTypings != null || files != null) {
      dependency.src = src
      dependency.main = main
      dependency.files = files
      dependency.browser = browser
      dependency.typings = typings
      dependency.browserTypings = browserTypings
    }

    dependency.dependencies = extend(dependency.dependencies, tree.dependencies)
    dependency.devDependencies = extend(dependency.devDependencies, tree.devDependencies)
    dependency.peerDependencies = extend(dependency.peerDependencies, tree.peerDependencies)
    dependency.ambientDependencies = extend(dependency.ambientDependencies, tree.ambientDependencies)
    dependency.ambientDevDependencies = extend(dependency.ambientDevDependencies, tree.ambientDevDependencies)
  }

  return dependency
}
