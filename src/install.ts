import extend = require('xtend')
import Promise = require('any-promise')
import { dirname, join } from 'path'
import { EventEmitter } from 'events'
import { resolveDependency, resolveTypeDependencies, DEFAULT_DEPENDENCY } from './lib/dependencies'
import { compile, CompileResult } from './lib/compile'
import { findConfigFile, findUp } from './utils/find'
import {
  transformConfig,
  mkdirp,
  touch,
  transformDtsFile,
  writeJson,
  writeFile,
  readJson,
  readConfig,
  treeToJson
} from './utils/fs'
import { resolveFrom, normalizeResolutions, getDependencyPath, getDefinitionPath } from './utils/path'
import { parseDependency, parseDependencyExpression, buildDependencyExpression } from './utils/parse'
import { DependencyTree, Dependency, DependencyBranch, Emitter, ResolutionMap } from './interfaces'
import { CONFIG_FILE } from './utils/config'

// Re-export useful expression building functions.
export { parseDependencyExpression, buildDependencyExpression }

/**
 * Options for installing a new dependency.
 */
export interface InstallDependencyOptions {
  save?: boolean
  saveDev?: boolean
  savePeer?: boolean
  global?: boolean
  cwd: string
  emitter?: Emitter
}

/**
 * Only options required for a full install.
 */
export interface InstallOptions {
  cwd: string
  production?: boolean
  emitter?: Emitter
}

/**
 * Consistent installation result.
 */
export interface InstallResult {
  tree: DependencyTree
  name?: string
}

/**
 * Options for compiling.
 */
export interface InstallDependencyNestedOptions extends InstallDependencyOptions {
  resolutions: ResolutionMap
}

/**
 * Install all dependencies on the current project.
 */
export function install (options: InstallOptions): Promise<InstallResult> {
  const { cwd, production } = options
  const emitter = options.emitter || new EventEmitter()

  return findConfigFile(cwd)
    .then(
      (configFile) => {
        const cwd = dirname(configFile)

        return readConfig(configFile)
          .then(config => {
            const resolutions = normalizeResolutions(config.resolution, options)

            return resolveTypeDependencies({
              cwd,
              emitter,
              global: true,
              peer: true,
              dev: !production
            })
              .then(tree => {
                const cwd = dirname(tree.src)
                const queue: Array<Promise<CompileResult>> = []

                function addToQueue (deps: DependencyBranch, global: boolean) {
                  for (const name of Object.keys(deps)) {
                    const tree = deps[name]

                    queue.push(compile(tree, Object.keys(resolutions), {
                      cwd,
                      name,
                      global,
                      emitter,
                      meta: true
                    }))
                  }
                }

                addToQueue(tree.dependencies, false)
                addToQueue(tree.devDependencies, false)
                addToQueue(tree.peerDependencies, false)
                addToQueue(tree.globalDependencies, true)
                addToQueue(tree.globalDevDependencies, true)

                return Promise.all(queue)
                  .then(results => {
                    return Promise.all(results.map(x => writeResult(x, { resolutions })))
                      .then(() => writeBundle(results, { resolutions }))
                      .then(() => ({ tree }))
                  })
              })
          })
      },
      () => {
        emitter.emit('enoent', { path: join(cwd, CONFIG_FILE) })

        return { tree: extend(DEFAULT_DEPENDENCY) }
      }
    )

}

/**
 * Multiple installation expressions.
 */
export interface InstallExpression {
  name: string
  location: string
}

/**
 * Backward compat with single dependency install.
 */
export function installDependencyRaw (raw: string, options: InstallDependencyOptions) {
  return installDependenciesRaw([raw], options).then(x => x[0])
}

/**
 * Install raw dependency strings.
 */
export function installDependenciesRaw (raw: string[], options: InstallDependencyOptions): Promise<InstallResult[]> {
  return new Promise(resolve => {
    const expressions = raw.map(x => parseDependencyExpression(x))

    return resolve(installDependencies(expressions, options))
  })
}

/**
 * Single wrapper to install a single dependency.
 */
export function installDependency (
  expression: InstallExpression,
  options: InstallDependencyOptions
): Promise<InstallResult> {
  return installDependencies([expression], options).then(x => x[0])
}

/**
 * Install a list of dependencies into the current project.
 */
export function installDependencies (
  expressions: InstallExpression[],
  options: InstallDependencyOptions
): Promise<InstallResult[]> {
  const emitter = options.emitter || new EventEmitter()

  return findConfigFile(options.cwd)
    .then(
      (configFile) => {
        const cwd = dirname(configFile)

        return readConfig(configFile)
          .then(config => {
            const resolutions = normalizeResolutions(config.resolution, options)

            return extend(options, { resolutions, cwd, emitter })
          })
      },
      () => {
        const resolutions = normalizeResolutions(undefined, options)

        return extend(options, { emitter, resolutions })
      }
    )
    .then(options => {
      return Promise.all(expressions.map(x => compileDependency(x, options)))
        .then(results => {
          return Promise.all(results.map(x => writeResult(x, options)))
            .then(() => writeBundle(results, options))
            .then(() => writeToConfig(results, options))
            .then(() => results.map(({ name, tree }) => ({ name, tree })))
        })
    })
}

/**
 * Install from a dependency string.
 */
function compileDependency (
  expression: InstallExpression,
  options: InstallDependencyNestedOptions
): Promise<CompileResult> {
  const dependency = parseDependency(expression.location)
  const { cwd, global, resolutions } = options
  const emitter = options.emitter || new EventEmitter()
  const expName = expression.name || dependency.meta.name

  return checkTypings(dependency, options)
    .then(() => {
      return resolveDependency(dependency, { cwd, emitter, name: expName, dev: false, peer: false, global: false })
    })
    .then(tree => {
      const name = expName || tree.name

      if (!name) {
        return Promise.reject(new TypeError(`Unable to install dependency from "${tree.raw}" without a name`))
      }

      if (tree.postmessage) {
        emitter.emit('postmessage', { name, message: tree.postmessage })
      }

      return compile(tree, Object.keys(resolutions), {
        cwd,
        name,
        global,
        emitter,
        meta: true
      })
    })
}

/**
 * Write a dependency to the configuration file.
 */
function writeToConfig (results: CompileResult[], options: InstallDependencyOptions) {
  if (options.save || options.saveDev || options.savePeer) {
    return transformConfig(options.cwd, config => {
      for (const { name, tree } of results) {
        const { raw } = tree

        // Extend different fields depending on the option passed in.
        if (options.save) {
          if (options.global) {
            config.globalDependencies = extend(config.globalDependencies, { [name]: raw })
          } else {
            config.dependencies = extend(config.dependencies, { [name]: raw })
          }
        } else if (options.saveDev) {
          if (options.global) {
            config.globalDevDependencies = extend(config.globalDevDependencies, { [name]: raw })
          } else {
            config.devDependencies = extend(config.devDependencies, { [name]: raw })
          }
        } else if (options.savePeer) {
          if (options.global) {
            throw new TypeError('Unable to use `savePeer` with the `global` flag')
          } else {
            config.peerDependencies = extend(config.peerDependencies, { [name]: raw })
          }
        }
      }

      return config
    })
  }

  return Promise.resolve()
}

/**
 * Write a dependency to the filesytem.
 */
function writeBundle (results: CompileResult[], options: { resolutions: ResolutionMap }): Promise<any> {
  const { resolutions } = options

  return Promise.all(Object.keys(resolutions).map(resolution => {
    const path = resolutions[resolution]
    const paths = results.map(({ name, global }) => getDependencyPath({ path, name, global }).definition)

    return mkdirp(path)
      .then(() => {
        const bundle = getDefinitionPath(path)

        if (paths.length === 0) {
          return touch(bundle)
        }

        return transformDtsFile(bundle, x => x.concat(paths))
      })
  }))
}

/**
 * Write a compilation result.
 */
function writeResult (result: CompileResult, options: { resolutions: ResolutionMap }): Promise<any> {
  const { name, global, tree, results } = result
  const { resolutions } = options

  return Promise.all(Object.keys(resolutions).map(resolution => {
    const path = resolutions[resolution]
    const contents = results[resolution]
    const { directory, config, definition } = getDependencyPath({ name, global, path })

    return mkdirp(directory)
      .then(() => {
        return Promise.all([
          writeJson(config, { resolution, tree: treeToJson(tree) }),
          writeFile(definition, contents)
        ])
      })
  }))
}

/**
 * Find existing `typings` that TypeScript supports.
 */
function checkTypings (dependency: Dependency, options: InstallDependencyOptions) {
  const { type, meta } = dependency

  // TypeScript only support NPM, as of today.
  if (type === 'registry' && meta.source === 'npm') {
    return findUp(options.cwd, join('node_modules', meta.name, 'package.json'))
      .then(path => {
        return readJson(path)
          .then(packageJson => {
            if (packageJson && typeof packageJson.typings === 'string') {
              options.emitter.emit('hastypings', {
                name: meta.name,
                source: meta.source,
                path: path,
                typings: resolveFrom(path, packageJson.typings)
              })
            }
          })
      })
      .catch(err => undefined)
  }

  return Promise.resolve()
}
