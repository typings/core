import extend = require('xtend')
import Promise = require('any-promise')
import promiseFinally from 'promise-finally'
import { EventEmitter } from 'events'
import { transformConfig, transformDtsFile, rimraf, isFile } from './utils/fs'
import { findProject } from './utils/find'
import { getDependencyLocation } from './utils/path'
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
 * Uninstall a dependency, given a name.
 */
export function uninstallDependency (name: string, options: UninstallDependencyOptions) {
  const emitter = options.emitter || new EventEmitter()

  // Remove the dependency from fs and config.
  function uninstall (name: string, options: UninstallDependencyOptions) {
    return removeDependency(name, options).then(() => writeToConfig(options))
  }

  return findProject(options.cwd)
    .then(
      (cwd) => uninstall(name, extend({ emitter }, options, { cwd })),
      () => uninstall(name, extend({ emitter }, options))
    )
}

/**
 * Delete the dependency from the configuration file.
 */
function writeToConfig (options: UninstallDependencyOptions) {
  if (options.save || options.saveDev) {
    return transformConfig(options.cwd, config => {
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

      return config
    })
  }
}

/**
 * Remove a dependency from the filesystem.
 */
function removeDependency (name: string, options: UninstallDependencyOptions) {
  const { cwd, ambient } = options
  const location = getDependencyLocation({ name, cwd, ambient })

  // Remove the dependency from typings.
  function remove (dir: string, path: string, dtsPath: string) {
    return isFile(path)
      .then(exists => {
        if (!exists) {
          options.emitter.emit('enoent', { path })
        }

        return promiseFinally(rimraf(dir), () => {
          return transformDtsFile(dtsPath, (typings) => {
            return typings.filter(x => x !== path)
          })
        })
      })
  }

  // Remove dependencies concurrently.
  return Promise.all([
    remove(location.mainPath, location.mainFile, location.mainDtsFile),
    remove(location.browserPath, location.browserFile, location.browserDtsFile)
  ]).then(() => undefined)
}