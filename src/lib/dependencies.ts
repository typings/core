import extend = require('xtend')
import listify = require('listify')
import invariant = require('invariant')
import zipObject = require('zip-object')
import { resolve, dirname, join } from 'path'
import { resolve as resolveUrl } from 'url'
import { readJspmPackageJson, resolveByPackageJson, resolve as resolveJspm, ModuleNotFoundError } from 'jspm-config'
import { readJson, readConfigFrom, readJsonFrom } from '../utils/fs'
import { parseDependency } from '../utils/parse'
import { findUp, findConfigFile } from '../utils/find'
import { isDefinition, isHttp } from '../utils/path'
import { CONFIG_FILE } from '../utils/config'
import { search } from '../search'
import { Dependency, DependencyBranch, Dependencies, DependencyTree, Emitter } from '../interfaces'
import TypingsError from './error'

/**
 * Default dependency config options.
 */
export const DEFAULT_DEPENDENCY: DependencyTree = {
  src: undefined,
  raw: undefined,
  main: undefined,
  browser: undefined,
  typings: undefined,
  browserTypings: undefined,
  version: undefined,
  files: undefined,
  global: undefined,
  postmessage: undefined,
  dependencies: {},
  devDependencies: {},
  peerDependencies: {},
  globalDependencies: {},
  globalDevDependencies: {}
}

/**
 * Options for resolving dependencies.
 */
export interface Options {
  cwd: string
  emitter: Emitter
  name?: string
  dev?: boolean
  peer?: boolean
  global?: boolean
  parent?: DependencyTree
  bowerComponentPath?: string
  jspmConfig?: any
}

/**
 * Resolve all dependencies at the current path.
 */
export function resolveAllDependencies (options: Options): Promise<DependencyTree> {
  return Promise.all([
    resolveBowerDependencies(options).catch(() => extend(DEFAULT_DEPENDENCY)),
    resolveNpmDependencies(options).catch(() => extend(DEFAULT_DEPENDENCY)),
    resolveJspmDependencies(options).catch(() => extend(DEFAULT_DEPENDENCY)),
    resolveTypeDependencies(options).catch(() => extend(DEFAULT_DEPENDENCY))
  ])
    .then((trees) => mergeDependencies(DEFAULT_DEPENDENCY, ...trees))
}

/**
 * Resolve a single dependency object.
 */
export function resolveDependency (dependency: Dependency, options: Options): Promise<DependencyTree> {
  const { type, location, raw, meta } = dependency

  if (type === 'registry') {
    return resolveDependencyRegistry(dependency, options)
  }

  if (type === 'github' || type === 'bitbucket') {
    if (meta.sha === 'master') {
      options.emitter.emit('badlocation', { type, raw, location })
    }
  }

  return resolveDependencyInternally(type, location, raw, options)
}

/**
 * Internal version of `resolveDependency`, skipping the registry handling.
 */
function resolveDependencyInternally (type: string, location: string, raw: string, options: Options) {
  if (type === 'jspm' || (type === 'npm' && options.jspmConfig)) {
    return resolveJspmDependency(location, raw, options)
  }

  if (type === 'npm') {
    return resolveNpmDependency(location, raw, options)
  }

  if (type === 'bower') {
    return resolveBowerDependency(location, raw, options)
  }

  return resolveFileDependency(location, raw, options)
}

/**
 * Resolving a registry dependency has an intermediate step.
 */
function resolveDependencyRegistry (dependency: Dependency, options: Options) {
  const { location, meta } = dependency

  return readJsonFrom(location)
    .then(
      function (entry) {
        // Rewrite dependency type and location, but recreate `raw`.
        const { type, location } = parseDependency(entry.location)
        const raw = `registry:${meta.source}/${meta.name}#${entry.tag}`

        if (entry.deprecated) {
          options.emitter.emit('deprecated', {
            parent: options.parent,
            raw: dependency.raw,
            date: new Date(entry.deprecated)
          })
        }

        return resolveDependencyInternally(type, location, raw, options)
      },
      function (error) {
        // Wrap 404 responses in user prompt.
        if (error.code === 'EINVALIDSTATUS' && error.status === 404) {
          return search({ name: meta.name })
            .then(res => {
              let message = `Unable to find "${meta.name}" ("${meta.source}") in the registry.`

              if (res.total > 0) {
                const plur = res.total === 1 ? 'source' : 'sources'

                message += `\nHowever, we found "${meta.name}" for ${res.total} other ${plur}: `
                message += `${listify(res.results.map(x => JSON.stringify(x.source)))}`
                message += `\nYou can install these using the "source" option.`
              }

              message += '\nWe could use your help adding these typings to the registry: '
              message += 'https://github.com/typings/registry'

              return Promise.reject(new TypingsError(message, error))
            })
        }

        return Promise.reject(error)
      }
    )
}

/**
 * Resolve a dependency in NPM.
 */
function resolveNpmDependency (pkgName: string, raw: string, options: Options) {
  return findUp(options.cwd, join('node_modules', pkgName))
    .then(
      function (modulePath: string) {
        if (isDefinition(modulePath)) {
          return resolveFileDependency(modulePath, raw, options)
        }

        return resolveNpmDependencyFrom(modulePath, raw, options)
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, options))
      }
    )
}

/**
 * Resolve a dependency in Bower.
 */
function resolveBowerDependency (name: string, raw: string, options: Options) {
  return resolveBowerComponentPath(options.cwd)
    .then(
      function (bowerComponentPath: string) {
        const modulePath = resolve(bowerComponentPath, name)

        if (isDefinition(modulePath)) {
          return resolveFileDependency(modulePath, raw, options)
        }

        return resolveBowerDependencyFrom(modulePath, raw, extend(options, { bowerComponentPath }))
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, options))
      }
    )
}

/**
 * Resolve a local file dependency.
 */
function resolveFileDependency (location: string, raw: string, options: Options): Promise<DependencyTree> {
  const { name, parent } = options
  let src: string

  if (isHttp(location)) {
    src = location
  } else if (parent && isHttp(parent.src)) {
    src = resolveUrl(parent.src, location)
  } else {
    src = resolve(options.cwd, location)
  }

  if (!isDefinition(src)) {
    return resolveTypeDependencyFrom(src, raw, options)
  }

  options.emitter.emit('resolve', { name, src, raw, parent })

  const tree: DependencyTree = extend(DEFAULT_DEPENDENCY, {
    typings: src,
    src,
    raw,
    parent
  })

  options.emitter.emit('resolved', { name, src, tree, raw, parent })

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
          .then(function (bowerComponentPath: string) {
            return resolveBowerDependencyFrom(bowerJsonPath, undefined, extend(options, { bowerComponentPath }))
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
function resolveBowerDependencyFrom (src: string, raw: string, options: Options): Promise<DependencyTree> {
  const { name, parent } = options

  checkCircularDependency(parent, src)

  options.emitter.emit('resolve', { name, src, raw, parent })

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
        const dependencyOptions = extend(options, { parent: tree })

        options.emitter.emit('resolved', { name: name || tree.name, src, tree, raw, parent })

        return Promise.all([
          resolveBowerDependencyMap(dependencyMap, dependencyOptions),
          resolveBowerDependencyMap(devDependencyMap, dependencyOptions),
          maybeResolveTypeDependencyFrom(join(src, '..', CONFIG_FILE), raw, options)
        ])
          .then(function ([dependencies, devDependencies, typedPackage]) {
            tree.dependencies = dependencies
            tree.devDependencies = devDependencies

            return mergeDependencies(tree, typedPackage)
          })
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, options))
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
function resolveBowerDependencyMap (dependencies: Dependencies, options: Options): Promise<DependencyBranch> {
  const keys = Object.keys(dependencies)

  return Promise.all(keys.map(function (name) {
    const modulePath = resolve(options.bowerComponentPath, name, 'bower.json')
    const resolveOptions: Options = extend(options, { name, dev: false, global: false, peer: false })

    return resolveBowerDependencyFrom(modulePath, `bower:${name}`, resolveOptions)
  }))
    .then(results => zipObject(keys, results))
}

/**
 * Follow and resolve npm dependencies.
 */
export function resolveNpmDependencies (options: Options): Promise<DependencyTree> {
  return findUp(options.cwd, 'package.json')
    .then(
      function (packageJsonPath: string) {
        return resolveNpmDependencyFrom(packageJsonPath, undefined, options)
      },
      function (cause) {
        return Promise.reject(new TypingsError(`Unable to resolve NPM dependencies`, cause))
      }
    )
}

/**
 * Follow and resolve JSPM dependencies.
 */
export function resolveJspmDependencies (options: Options): Promise<DependencyTree> {
  return findUp(options.cwd, 'package.json')
    .then(function (packageJsonPath: string) {
      const cwd = dirname(packageJsonPath)

      return readJspmPackageJson({ cwd })
        .then(function (packageJson) {
          return resolveByPackageJson(packageJson, { cwd })
            .then(function (config) {
              const keys = Object.keys(config)

              return Promise.all(keys.map(function (name) {
                const jspmConfig = config[name]

                return resolveJspmDependencyFrom(name, `jspm:${name}`, extend(options, { jspmConfig }))
              }))
                .then(results => {
                  const tree: DependencyTree = extend(DEFAULT_DEPENDENCY, {
                    name: packageJson.name,
                    version: packageJson.version,
                    main: packageJson.main,
                    browser: packageJson.browser,
                    typings: packageJson.typings,
                    browserTypings: packageJson.browserTypings,
                    src: packageJsonPath,
                    dependencies: zipObject(keys, results)
                  })

                  return tree
                })
            })
        })
    })
}

/**
 * Resolve NPM dependencies from `package.json`.
 */
function resolveNpmDependencyFrom (src: string, raw: string, options: Options): Promise<DependencyTree> {
  const { name, parent } = options

  checkCircularDependency(parent, src)

  options.emitter.emit('resolve', { name, src, raw, parent })

  return readJson(src)
    .then(
      function (packageJson: any = {}) {
        const tree: DependencyTree = extend(DEFAULT_DEPENDENCY, {
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
        const dependencyOptions = extend(options, { parent: tree })

        options.emitter.emit('resolved', { name: name || tree.name, src, tree, raw, parent })

        return Promise.all([
          resolveNpmDependencyMap(src, dependencyMap, dependencyOptions),
          resolveNpmDependencyMap(src, devDependencyMap, dependencyOptions),
          resolveNpmDependencyMap(src, peerDependencyMap, dependencyOptions),
          maybeResolveTypeDependencyFrom(join(src, '..', CONFIG_FILE), raw, options)
        ])
          .then(function ([dependencies, devDependencies, peerDependencies, typedPackage]) {
            tree.dependencies = dependencies
            tree.devDependencies = devDependencies
            tree.peerDependencies = peerDependencies

            return mergeDependencies(tree, typedPackage)
          })
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, options))
      }
    )
}

/**
 * Recursively resolve dependencies from a list and component path.
 */
function resolveNpmDependencyMap (src: string, dependencies: any, options: Options): Promise<DependencyBranch> {
  const cwd = dirname(src)
  const keys = Object.keys(dependencies)

  return Promise.all(keys.map(function (name) {
    const resolveOptions: Options = extend(options, { name, cwd, dev: false, peer: false, global: false })

    return resolveNpmDependency(join(name, 'package.json'), `npm:${name}`, resolveOptions)
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
function resolveTypeDependencyFrom (src: string, raw: string, options: Options) {
  const { name, parent } = options

  checkCircularDependency(parent, src)

  options.emitter.emit('resolve', { name, src, raw, parent })

  return readConfigFrom(src)
    .then<DependencyTree>(
      function (config) {
        const tree = extend(DEFAULT_DEPENDENCY, {
          name: config.name,
          main: config.main,
          version: config.version,
          browser: config.browser,
          files: Array.isArray(config.files) ? config.files : undefined,
          global: typeof config.global === 'boolean' ? !!config.global : undefined,
          postmessage: typeof config.postmessage === 'string' ? config.postmessage : undefined,
          src,
          raw,
          parent
        })

        const { global, dev, peer } = options

        const dependencyMap = extend(config.dependencies)
        const devDependencyMap = extend(dev ? config.devDependencies : {})
        const peerDependencyMap = extend(peer ? config.peerDependencies : {})
        const globalDependencyMap = extend(global ? config.globalDependencies : {})
        const globalDevDependencyMap = extend(global && dev ? config.globalDevDependencies : {})
        const dependencyOptions = extend(options, { parent: tree })

        options.emitter.emit('resolved', { name: name || tree.name, src, tree, raw, parent })

        // Emit "expected" global modules when installing top-level.
        if (parent == null && config.globalDependencies) {
          options.emitter.emit('globaldependencies', {
            name: name || tree.name,
            raw,
            dependencies: config.globalDependencies
          })
        }

        return Promise.all([
          resolveTypeDependencyMap(src, dependencyMap, dependencyOptions),
          resolveTypeDependencyMap(src, devDependencyMap, dependencyOptions),
          resolveTypeDependencyMap(src, peerDependencyMap, dependencyOptions),
          resolveTypeDependencyMap(src, globalDependencyMap, dependencyOptions),
          resolveTypeDependencyMap(src, globalDevDependencyMap, dependencyOptions)
        ])
          .then(function ([
            dependencies,
            devDependencies,
            peerDependencies,
            globalDependencies,
            globalDevDependencies
          ]) {
            tree.dependencies = dependencies
            tree.devDependencies = devDependencies
            tree.peerDependencies = peerDependencies
            tree.globalDependencies = globalDependencies
            tree.globalDevDependencies = globalDevDependencies

            return tree
          })
      },
      function (error) {
        return Promise.reject(resolveError(raw, error, options))
      }
    )
}

/**
 * Resolve type dependency ignoring not found issues (E.g. when mixed resolve NPM/Bower).
 */
function maybeResolveTypeDependencyFrom (src: string, raw: string, options: Options) {
  return resolveTypeDependencyFrom(src, raw, options).catch(() => extend(DEFAULT_DEPENDENCY))
}

/**
 * Resolve type dependency map from a cache directory.
 */
function resolveTypeDependencyMap (src: string, dependencies: any, options: Options) {
  const cwd = dirname(src)
  const keys = Object.keys(dependencies)

  return Promise.all(keys.map(function (name) {
    const resolveOptions: Options = extend(options, { name, cwd, dev: false, global: false, peer: false })

    return resolveDependency(parseDependency(dependencies[name]), resolveOptions)
  }))
    .then(results => zipObject(keys, results))
}

/**
 * Resolve a dependency from JSPM.
 */
export function resolveJspmDependency (pkgName: string, raw: string, options: Options): Promise<DependencyTree> {
  return findUp(options.cwd, 'package.json')
    .then(function (packageJsonPath) {
      return resolveJspm(pkgName, { cwd: dirname(packageJsonPath) })
    })
    .then(
      function (jspmConfig) {
        return resolveJspmDependencyFrom(pkgName, raw, extend(options, { jspmConfig }))
      },
      function (error) {
        if (error instanceof ModuleNotFoundError) {
          return resolveJspmDependencyFrom(pkgName, raw, options)
        }
        return Promise.reject(resolveError(raw, error, options))
      }
    )
}

/**
 * Resolve JSPM dependency.
 */
function resolveJspmDependencyFrom (name: string, raw: string, options: Options): Promise<DependencyTree> {
  const { parent, jspmConfig } = options
  const modulePath = jspmConfig.path
  const src = resolve(options.cwd, modulePath, 'package.json')

  checkCircularDependency(parent, src)

  options.emitter.emit('resolve', { name, src, raw, parent })

  return readJson(src)
    .catch(function (err) {
      // Ignore `FileNotFound` errors.
      if (err.code === 'ENOENT') {
        return
      }

      return Promise.reject(err)
    })
    .then(function (meta: any = {}) {
      const tree = extend(DEFAULT_DEPENDENCY, {
        src,
        raw,
        parent,
        name: meta.name,
        version: meta.version,
        main: meta.main,
        browser: meta.browser,
        typings: meta.typings,
        browserTypings: meta.browserTypings
      })

      options.emitter.emit('resolved', { name, src, tree, raw, parent })

      const dependencyOptions = extend(options, { parent: tree })
      const configPath = resolve(options.cwd, modulePath, CONFIG_FILE)

      return Promise.all([
        resolveJspmDependencyMap(jspmConfig.map, dependencyOptions),
        maybeResolveTypeDependencyFrom(configPath, raw, options)
      ])
        .then(([dependencies, typedPackage]) => {
          tree.dependencies = dependencies

          return mergeDependencies(tree, typedPackage)
        })
    })
}

/**
 * Recursively resolve dependencies from a list and component path.
 */
function resolveJspmDependencyMap (dependencies: DependencyBranch = {}, options: Options): Promise<DependencyBranch> {
  const keys = Object.keys(dependencies)

  return Promise.all(keys.map(function (name) {
    const resolveOptions = extend(options, { dev: false, peer: false, global: false, jspmConfig: dependencies[name] })

    return resolveJspmDependencyFrom(name, `jspm:${name}`, resolveOptions)
  }))
    .then(results => zipObject(keys, results))
}

/**
 * Check whether the filename is a circular dependency.
 */
function checkCircularDependency (tree: DependencyTree, filename: string) {
  if (tree) {
    const currentSrc = tree.src

    while (tree) {
      invariant(tree.src !== filename, `Circular dependency detected using "${currentSrc}"`)

      tree = tree.parent
    }
  }
}

/**
 * Create a resolved failure error message.
 */
function resolveError (raw: string, cause: Error, options: Options) {
  const { name } = options
  let message = `Unable to resolve ${raw == null ? 'typings' : `"${raw}"`}`

  if (name != null) {
    message += ` from "${name}"`
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

    const { name, raw, src, main, browser, typings, browserTypings, parent, files, global } = tree

    // The parent needs to always be set.
    if (parent != null) {
      dependency.parent = parent
    }

    // Merge known global properties.
    if (global != null) {
      dependency.global = global
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

    dependency.postmessage = tree.postmessage || dependency.postmessage
    dependency.dependencies = extend(dependency.dependencies, tree.dependencies)
    dependency.devDependencies = extend(dependency.devDependencies, tree.devDependencies)
    dependency.peerDependencies = extend(dependency.peerDependencies, tree.peerDependencies)
    dependency.globalDependencies = extend(dependency.globalDependencies, tree.globalDependencies)
    dependency.globalDevDependencies = extend(dependency.globalDevDependencies, tree.globalDevDependencies)
  }

  return dependency
}
