import Promise = require('any-promise')
import { resolve, dirname } from 'path'
import { EventEmitter } from 'events'
import { resolveAllDependencies } from './lib/dependencies'
import { CompileResult, compile } from './lib/compile'
import { writeFile, mkdirp } from './utils/fs'
import { Emitter } from './interfaces'
import { InstallResult } from './install'

/**
 * Bundle configuration options.
 */
export interface BundleOptions {
  name?: string
  cwd: string
  ambient?: boolean
  resolution?: string
  out: string
  emitter?: Emitter
}

/**
 * Bundle the current typings project into a single ambient definition.
 */
export function bundle (options: BundleOptions): Promise<InstallResult> {
  const { cwd, ambient, out } = options
  const emitter = options.emitter || new EventEmitter()
  const resolution = options.resolution || 'main'

  if (out == null) {
    return Promise.reject(new TypeError('Out directory is required for bundle'))
  }

  return resolveAllDependencies({ cwd, dev: false, ambient: false, emitter })
    .then(tree => {
      const name = options.name || tree.name

      if (name == null) {
        return Promise.reject(new TypeError(
          'Unable to infer typings name from project. Use the `--name` flag to specify it manually'
        ))
      }

      return compile(tree, [resolution], { cwd, name, ambient, emitter, meta: true })
    })
    .then((output: CompileResult) => {
      const path = resolve(cwd, out)

      return mkdirp(dirname(path))
        .then(() => {
          return writeFile(path, output.results[resolution])
        })
        .then(() => ({ tree: output.tree }))
    })
}
