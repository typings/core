import extend = require('xtend')
import { EventEmitter } from 'events'
import { dirname } from 'path'
import { transformConfig, transformDtsFile, rmdirUntil, unlink, isFile, readConfig } from './utils/fs'
import { findConfigFile } from './utils/find'
import { getDependencyPath, normalizeResolutions, getDefinitionPath } from './utils/path'
import { Emitter, ResolutionMap } from './interfaces'

/**
 * Uninstall options.
 */
export interface UninstallDependencyOptions {
  save?: boolean
  saveDev?: boolean
  savePeer?: boolean
  global?: boolean
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
      return Promise.all(names.map(x => uninstallFrom(x, options)))
        .then(() => writeBundle(names, options))
        .then(() => writeToConfig(names, options))
        .then(() => options)
    })
}

interface UninstallDependencyNestedOptions extends UninstallDependencyOptions {
  resolutions: ResolutionMap
}

/**
 * Uninstall the dependency.
 */
function uninstallFrom (name: string, options: UninstallDependencyNestedOptions) {
  const { cwd, global, emitter, resolutions } = options

  return Promise.all(Object.keys(resolutions).map(type => {
    const path = resolutions[type]
    const { directory, definition, config } = getDependencyPath({ path, name, global })

    return isFile(definition)
      .then(exists => {
        if (!exists) {
          emitter.emit('enoent', { path: definition })

          return
        }

        return Promise.all([
          unlink(definition),
          unlink(config)
        ])
          .then(() => rmdirUntil(directory, cwd))
      })
  }))
}

/**
 * Delete the dependency from the configuration file.
 */
function writeToConfig (names: string[], options: UninstallDependencyOptions) {
  if (options.save || options.saveDev || options.savePeer) {
    return transformConfig(options.cwd, config => {
      for (const name of names) {
        if (options.save) {
          if (options.global) {
            if (config.globalDependencies && config.globalDependencies[name]) {
              delete config.globalDependencies[name]
            } else {
              return Promise.reject(new TypeError(`Typings for "${name}" are not listed in global dependencies`))
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
          if (options.global) {
            if (config.globalDevDependencies && config.globalDevDependencies[name]) {
              delete config.globalDevDependencies[name]
            } else {
              return Promise.reject(new TypeError(`Typings for "${name}" are not listed in global dev dependencies`))
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
function writeBundle (names: string[], options: UninstallDependencyNestedOptions) {
  const { global, resolutions } = options

  return Promise.all(Object.keys(resolutions).map(type => {
    const path = resolutions[type]
    const bundle = getDefinitionPath(path)
    const paths = names.map(name => getDependencyPath({ path, name, global }).definition)

    return transformDtsFile(bundle, references => {
      return references.filter(x => paths.indexOf(x) === -1)
    })
  }))
}
