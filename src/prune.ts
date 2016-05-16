import { dirname } from 'path'
import Promise = require('any-promise')
import extend = require('xtend')
import { EventEmitter } from 'events'
import { Emitter } from './interfaces'
import { findConfigFile } from './utils/find'
import { readConfig, transformDtsFile, rmdirUntil, unlink, isFile } from './utils/fs'
import { normalizeResolutions, getInfoFromDependencyLocation, getDefinitionPath, getDependencyPath } from './utils/path'
import { ConfigJson, Dependencies } from './interfaces'

export interface PruneOptions {
  cwd: string
  production?: boolean
  emitter?: Emitter
}

/**
 * Prune non-persisted type defintions.
 */
export function prune (options: PruneOptions): Promise<void> {
  const { cwd, production } = options
  const emitter = options.emitter || new EventEmitter()

  return findConfigFile(cwd)
    .then(path => {
      const cwd = dirname(path)

      return readConfig(path)
        .then(config => {
          return transformBundles(config, { cwd, production, emitter })
        })
    })
}

/**
 * Read the bundle and remove typings not in config file.
 */
function transformBundles (config: ConfigJson, options: PruneOptions) {
  const { production } = options
  const resolutions = normalizeResolutions(config.resolution, options)
  const dependencies = extend(config.dependencies, config.peerDependencies, production ? {} : config.devDependencies)
  const ambientDependencies = extend(config.ambientDependencies, production ? {} : config.ambientDevDependencies)

  return Promise.all(Object.keys(resolutions).map(type => {
    return transformBundle(resolutions[type], type, dependencies, ambientDependencies, options)
  })).then(() => undefined)
}

/**
 * Transform a bundle file and remove extra dependencies.
 */
function transformBundle (
  path: string,
  resolution: string,
  dependencies: Dependencies,
  ambientDependencies: Dependencies,
  options: PruneOptions
) {
  const { emitter } = options
  const rmQueue: Array<Promise<void>> = []
  const bundle = getDefinitionPath(path)

  return isFile(bundle)
    .then(exists => {
      // Avoid pruning an un-installed tree.
      if (!exists) {
        return
      }

      return transformDtsFile(bundle, typings => {
        const infos = typings.map(x => getInfoFromDependencyLocation(x, bundle))
        const validPaths: string[] = []

        for (const { name, ambient, location } of infos) {
          if (ambient) {
            if (!ambientDependencies.hasOwnProperty(name)) {
              emitter.emit('prune', { name, ambient, resolution })
              rmQueue.push(rmDependency({ name, ambient, path, emitter }))
            } else {
              validPaths.push(location)
            }
          } else {
            if (!dependencies.hasOwnProperty(name)) {
              emitter.emit('prune', { name, ambient, resolution })
              rmQueue.push(rmDependency({ name, ambient, path, emitter }))
            } else {
              validPaths.push(location)
            }
          }
        }

        return validPaths
      })
    })
    .then(() => Promise.all(rmQueue))
    .then(() => undefined)
}

/**
 * Remove a dependency.
 */
export function rmDependency (options: { name: string, ambient: boolean, path: string, emitter: Emitter }) {
  const { path, emitter } = options
  const { directory, definition, config } = getDependencyPath(options)

  // Remove files and emit warning on ENOENT.
  function remove (path: string) {
    return isFile(path)
      .then(exists => {
        if (!exists) {
          emitter.emit('enoent', { path })

          return
        }

        return unlink(path)
      })
  }

  return Promise.all([
    remove(config),
    remove(definition)
  ])
    .then(() => rmdirUntil(directory, path))
}
