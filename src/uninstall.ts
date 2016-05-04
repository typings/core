import extend = require('xtend')
import Promise = require('any-promise')
import { EventEmitter } from 'events'
import { transformConfig, transformDtsFile, rmUntil, readConfig } from './utils/fs'
import { findProject, findConfigFile } from './utils/find'
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
  const { cwd, ambient, emitter } = options
  const location = getDependencyLocation({ name, cwd, ambient })

  findConfigFile(options.cwd)
    .then(path => readConfig(path))
    .then(config => {
      const {resolution} = config
      let rm: Promise<any>[] = []

      if (!resolution || resolution === 'main' || resolution === 'both') {
        rm.push(rmUntil(location.main, { cwd, emitter }))
      }
      if (resolution && (resolution === 'browser' || resolution === 'both')) {
        rm.push(rmUntil(location.browser, { cwd, emitter }))
      }

      return Promise.all(rm)
    })
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
  const mainLocations = locations.map(x => x.main)
  const browserLocations = locations.map(x => x.browser)

  return Promise.all([
    transformDtsFile(bundle.main, x => x.filter(x => mainLocations.indexOf(x) === -1)),
    transformDtsFile(bundle.browser, x => x.filter(x => browserLocations.indexOf(x) === -1))
  ])
}
