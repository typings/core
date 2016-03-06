import Promise = require('any-promise')
import { resolve, join } from 'path'
import { EventEmitter } from 'events'
import { resolveAllDependencies } from './lib/dependencies'
import compile, { CompiledOutput } from './lib/compile'
import { writeFile, mkdirp } from './utils/fs'
import { Emitter } from './interfaces'

/**
 * Bundle configuration options.
 */
export interface BundleOptions {
  name?: string
  cwd: string
  ambient: boolean
  out: string
  emitter?: Emitter
}

/**
 * Bundle the current typings project into a single ambient definition.
 */
export function bundle (options: BundleOptions): Promise<CompiledOutput> {
  const { cwd, ambient, out } = options
  const emitter = options.emitter || new EventEmitter()

  if (out == null) {
    return Promise.reject(new TypeError('Out directory is required for bundle'))
  }

  return resolveAllDependencies({ cwd, dev: false, ambient, emitter })
    .then(tree => {
      const name = options.name || tree.name

      if (name == null) {
        return Promise.reject(new TypeError(
          'Unable to infer typings name from project. Use the `--name` flag to specify it manually'
        ))
      }

      return compile(tree, { cwd, name, ambient, emitter, meta: true })
    })
    .then((output: CompiledOutput) => {
      const path = resolve(cwd, out)

      return mkdirp(path)
        .then(() => {
          return Promise.all([
            writeFile(join(path, 'main.d.ts'), output.main),
            writeFile(join(path, 'browser.d.ts'), output.browser)
          ])
        })
        .then(() => output)
    })
}
