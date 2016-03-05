import extend = require('xtend')
import Promise = require('any-promise')
import promiseFinally from 'promise-finally'
import { transformConfig, transformDtsFile, rimraf } from './utils/fs'
import { findProject } from './utils/find'
import { getDependencyLocation } from './utils/path'

/**
 * Uninstall options.
 */
export interface UninstallDependencyOptions {
  save?: boolean
  saveDev?: boolean
  savePeer?: boolean
  ambient?: boolean
  name: string
  cwd: string
}

/**
 * Uninstall a dependency, given a name.
 */
export function uninstallDependency (options: UninstallDependencyOptions) {
  // Remove the dependency from fs and config.
  function uninstall (options: UninstallDependencyOptions) {
    return removeDependency(options).then(() => writeToConfig(options))
  }

  return findProject(options.cwd)
    .then(
      (cwd) => uninstall(extend(options, { cwd })),
      () => uninstall(options)
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
export function removeDependency (options: UninstallDependencyOptions) {
  const location = getDependencyLocation(options)

  // Remove the dependency from typings.
  function remove (path: string, file: string, dtsFile: string) {
    return promiseFinally(rimraf(path), () => {
      return transformDtsFile(dtsFile, (typings) => {
        return typings.filter(x => x !== file)
      })
    })
  }

  // Remove dependencies concurrently.
  return Promise.all([
    remove(location.mainPath, location.mainFile, location.mainDtsFile),
    remove(location.browserPath, location.browserFile, location.browserDtsFile)
  ]).then(() => undefined)
}