import { dirname } from 'path'
import Promise = require('any-promise')
import extend = require('xtend')
import { EventEmitter } from 'events'
import { Emitter } from './interfaces'
import { findConfigFile } from './utils/find'
import { readConfig, transformDtsFile, rmUntil } from './utils/fs'
import { getTypingsLocation, getInfoFromDependencyLocation } from './utils/path'
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
  const bundle = getTypingsLocation(options)
  const dependencies = extend(config.dependencies, config.peerDependencies, production ? {} : config.devDependencies)
  const ambientDependencies = extend(config.ambientDependencies, production ? {} : config.ambientDevDependencies)

  return Promise.all([
    transformBundle(bundle.main, dependencies, ambientDependencies, options),
    transformBundle(bundle.browser, dependencies, ambientDependencies, options)
  ]).then(() => undefined)
}

/**
 * Transform a bundle file and remove extra dependencies.
 */
function transformBundle (path: string, dependencies: Dependencies, ambientDependencies: Dependencies, options: PruneOptions) {
  const { emitter } = options
  const cwd = dirname(path)
  const rmQueue: Array<Promise<void>> = []

  return transformDtsFile(path, typings => {
    const infos = typings.map(x => getInfoFromDependencyLocation(x, { cwd }))
    const validPaths: string[] = []

    for (const { name, ambient, path, browser } of infos) {
      if (ambient) {
        if (!ambientDependencies.hasOwnProperty(name)) {
          emitter.emit('prune', { name, ambient, browser })
          rmQueue.push(rmUntil(path, { cwd, emitter }))
        } else {
          validPaths.push(path)
        }
      } else {
        if (!dependencies.hasOwnProperty(name)) {
          emitter.emit('prune', { name, ambient, browser })
          rmQueue.push(rmUntil(path, { cwd, emitter }))
        } else {
          validPaths.push(path)
        }
      }
    }

    return validPaths
  })
    .then(() => Promise.all(rmQueue))
    .then(() => undefined)
}
