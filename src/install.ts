import extend = require('xtend')
import Promise = require('any-promise')
import { dirname, join } from 'path'
import { EventEmitter } from 'events'
import { resolveDependency, resolveTypeDependencies } from './lib/dependencies'
import compile, { CompileResult } from './lib/compile'
import { findProject, findUp, findConfigFile } from './utils/find'
import { transformConfig, mkdirp, touch, transformDtsFile, readJson, mkdirpAndWriteFile, rimraf, unlink, readConfig } from './utils/fs'
import { getTypingsLocation, getDependencyLocation, resolveFrom } from './utils/path'
import { parseDependency, parseDependencyExpression, buildDependencyExpression } from './utils/parse'
import { DependencyTree, Dependency, DependencyBranch, Emitter } from './interfaces'

export { parseDependencyExpression, buildDependencyExpression }

/**
 * Options for installing a new dependency.
 */
export interface InstallDependencyOptions {
  save?: boolean
  saveDev?: boolean
  savePeer?: boolean
  ambient?: boolean
  cwd: string
  emitter?: Emitter
	resolution?: string
}

/**
 * Only options required for a full install.
 */
export interface InstallOptions {
  cwd: string
  production?: boolean
  emitter?: Emitter
	resolution?: string
}

/**
 * Consistent installation result.
 */
export interface InstallResult {
  tree: DependencyTree
  name?: string
}

/**
 * Install all dependencies on the current project.
 */
export function install (options: InstallOptions): Promise<InstallResult> {
  const { cwd, production } = options
  const emitter = options.emitter || new EventEmitter()

  return resolveTypeDependencies({ cwd, emitter, ambient: true, peer: true, dev: !production })
    .then(tree => {
      const cwd = dirname(tree.src)
      const queue: Array<Promise<CompileResult>> = []

      function addToQueue (deps: DependencyBranch, ambient: boolean) {
        for (const name of Object.keys(deps)) {
          const tree = deps[name]

          queue.push(compile(tree, { cwd, name, ambient, emitter, meta: true }))
        }
      }

      addToQueue(tree.dependencies, false)
      addToQueue(tree.devDependencies, false)
      addToQueue(tree.peerDependencies, false)
      addToQueue(tree.ambientDependencies, true)
      addToQueue(tree.ambientDevDependencies, true)

      return Promise.all(queue)
        .then(results => {
          return Promise.all(results.map(x => writeResult(x)))
            .then(() => writeBundle(results, options))
            .then(() => ({ tree }))
        })
    })
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
    const expressions = raw.map(x => parseDependencyExpression(x, options))

    return resolve(installDependencies(expressions, options))
  })
}

/**
 * Single wrapper to install a single dependency.
 */
export function installDependency (expression: InstallExpression, options: InstallDependencyOptions): Promise<InstallResult> {
  return installDependencies([expression], options).then(x => x[0])
}

/**
 * Install a list of dependencies into the current project.
 */
export function installDependencies (expressions: InstallExpression[], options: InstallDependencyOptions): Promise<InstallResult[]> {
  const emitter = options.emitter || new EventEmitter()

  return findProject(options.cwd)
    .then(
      (cwd) => extend(options, { cwd, emitter }),
      () => extend(options, { emitter })
    )
    .then(options => {
      return Promise.all(expressions.map(x => compileDependency(x, options)))
        .then(results => {
          return Promise.all(results.map(x => writeResult(x)))
            .then(() => writeBundle(results, options))
            .then(() => writeToConfig(results, options))
            .then(() => results.map(({ name, tree }) => ({ name, tree })))
        })
    })
}

/**
 * Install from a dependency string.
 */
function compileDependency (expression: InstallExpression, options: InstallDependencyOptions): Promise<CompileResult> {
  const dependency = parseDependency(expression.location)
  const { cwd, ambient } = options
  const emitter = options.emitter || new EventEmitter()
  const expName = expression.name || dependency.meta.name

  return checkTypings(dependency, options)
    .then(() => {
      return resolveDependency(dependency, { cwd, emitter, name: expName, dev: false, peer: false, ambient: false })
    })
    .then(tree => {
      const name = expName || tree.name

      if (!name) {
        return Promise.reject(new TypeError(`Unable to install dependency from "${tree.raw}" without a name`))
      }

      if (tree.postmessage) {
        emitter.emit('postmessage', { name, message: tree.postmessage })
      }

      return compile(tree, {
        cwd,
        name,
        ambient,
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
          if (options.ambient) {
            config.ambientDependencies = extend(config.ambientDependencies, { [name]: raw })
          } else {
            config.dependencies = extend(config.dependencies, { [name]: raw })
          }
        } else if (options.saveDev) {
          if (options.ambient) {
            config.ambientDevDependencies = extend(config.ambientDevDependencies, { [name]: raw })
          } else {
            config.devDependencies = extend(config.devDependencies, { [name]: raw })
          }
        } else if (options.savePeer) {
          if (options.ambient) {
            throw new TypeError('Unable to use `savePeer` with the `ambient` flag')
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
function writeBundle (results: CompileResult[], options: { cwd: string, resolution?: string }): Promise<any> {
  const bundle = getTypingsLocation(options)
  const locations = results.map(x => getDependencyLocation(x))

  return mkdirp(bundle.typings)
    .then(() => {
	    return Promise.all(
		    locations.length === 0
		      ? [
			        touch(bundle.main),
			        touch(bundle.browser)
		        ]
			    : [
			        transformDtsFile(bundle.main, x => x.concat(locations.map(x => x.main))),
			        transformDtsFile(bundle.browser, x => x.concat(locations.map(x => x.browser)))
		        ]
		    )
		    .then(() => findConfigFile(options.cwd))
		    .then(path => readConfig(path))
	      .then(config => {
		      const {resolution} = config
		      let deresolution: string

		      // resolution default is 'main' only,
		      // but can specify 'main', 'browser', or 'both' (or more precisely anything other than 'main' or 'browser')
		      if(!resolution || resolution === 'main')
			      deresolution = 'browser'
		      else if(resolution && resolution === 'browser')
			      deresolution = 'main'

		      if(deresolution)
			      return Promise.all([
				      rimraf(join(dirname((<any>bundle)[deresolution]), deresolution)),
				      unlink((<any>bundle)[deresolution])
			      ])
	      })
    })
}

/**
 * Write a compilation result.
 */
function writeResult (result: CompileResult): Promise<any> {
  const location = getDependencyLocation(result)

  return Promise.all([
    mkdirpAndWriteFile(location.main, result.main),
    mkdirpAndWriteFile(location.browser, result.browser)
  ])
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
