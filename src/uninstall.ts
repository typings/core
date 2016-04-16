import extend = require('xtend')
import Promise = require('any-promise')
import { EventEmitter } from 'events'
import { dirname } from 'path'
import { transformConfig, transformDtsFile, unlink, isFile, rmdirUntil } from './utils/fs'
import { findProject } from './utils/find'
import { getDependencyLocation, getTypingsLocation } from './utils/path'
import { Emitter } from './interfaces'

/**
 * Uninstall options.
 */
export interface UninstallDependencyOptions {
  save?: boolean
  saveDev?: boolean
  savePeer?: boolean
  ambient?: boolean
  cwd: string
  emitter?: Emitter
}

/**
 * Uninstall a single dependency.
 */
export function uninstallDependency (name: string, options: UninstallDependencyOptions) {
  return uninstallDependencies([name], options)
}

/**
 * Uninstall a list of dependencies.
 */
export function uninstallDependencies (names: string[], options: UninstallDependencyOptions) {
  const emitter = options.emitter || new EventEmitter()

  return findProject(options.cwd)
    .then(
      (cwd) => extend(options, { cwd, emitter }),
      () => extend(options, { emitter })
    )
    .then(options => {
      return Promise.all(names.map(x => uninstallFrom(x, options)))
        .then(() => writeBundle(names, options))
        .then(() => writeToConfig(names, options))
        .then(() => undefined)
    })
}

/**
 * Uninstall the dependency.
 */
function uninstallFrom (name: string, options: UninstallDependencyOptions) {
  const { cwd, ambient } = options
  const location = getDependencyLocation({ name, cwd, ambient })

  return Promise.all([
    uninstall(location.main, location.mainDir, options),
    uninstall(location.browser, location.browserDir, options)
  ])
}

/**
 * Uninstall a path recursively.
 */
function uninstall (path: string, root: string, options: UninstallDependencyOptions) {
  return isFile(path)
    .then(exists => {
      if (exists) {
        return unlink(path)
      }

      options.emitter.emit('enoent', { path })
    })
    .then(() => rmdirUntil(dirname(path), root))
}

/**
 * Delete the dependency from the configuration file.
 */
function writeToConfig (names: string[], options: UninstallDependencyOptions) {
  if (options.save || options.saveDev || options.savePeer) {
    return transformConfig(options.cwd, config => {
      for (const name of names) {
        if (options.save) {
          if (options.ambient) {
            if (config.ambientDependencies && config.ambientDependencies[name]) {
              delete config.ambientDependencies[name]
            } else {
              return Promise.reject(new TypeError(`Typings for "${name}" are not listed in ambient dependencies`))
            }
          } else {
            if (config.dependencies && config.dependencies[name]) {
              delete config.dependencies[name]
            } else {
              return Promise.reject(new TypeError(`Typings for "${name}" are not listed in dependencies`))
            }
          }
        }

        if (options.saveDev) {
          if (options.ambient) {
            if (config.ambientDevDependencies && config.ambientDevDependencies[name]) {
              delete config.ambientDevDependencies[name]
            } else {
              return Promise.reject(new TypeError(`Typings for "${name}" are not listed in ambient dev dependencies`))
            }
          } else {
            if (config.devDependencies && config.devDependencies[name]) {
              delete config.devDependencies[name]
            } else {
              return Promise.reject(new TypeError(`Typings for "${name}" are not listed in dev dependencies`))
            }
          }
        }

        if (options.savePeer) {
          if (config.peerDependencies && config.peerDependencies[name]) {
            delete config.peerDependencies[name]
          } else {
            return Promise.reject(new TypeError(`Typings for "${name}" are not listed in peer dependencies`))
          }
        }
      }

      return config
    })
  }
}

/**
 * Write the uninstall result to the bundle.
 */
function writeBundle (names: string[], options: UninstallDependencyOptions) {
  const { cwd, ambient } = options
  const bundle = getTypingsLocation(options)
  const locations = names.map(name => getDependencyLocation({ name, cwd, ambient }))

  return Promise.all([
    transformDtsFile(bundle.main, x => x.concat(locations.map(x => x.main))),
    transformDtsFile(bundle.browser, x => x.concat(locations.map(x => x.browser)))
  ])
}
