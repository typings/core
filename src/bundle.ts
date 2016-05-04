import Promise = require('any-promise')
import { resolve, join } from 'path'
import { EventEmitter } from 'events'
import { resolveAllDependencies } from './lib/dependencies'
import compile, { CompileResult } from './lib/compile'
import { writeFile, mkdirp, readConfig } from './utils/fs'
import { findConfigFile } from './utils/find';
import { Emitter } from './interfaces'
import { InstallResult } from './install'

/**
 * Bundle configuration options.
 */
export interface BundleOptions {
  name?: string
  cwd: string
  ambient?: boolean
  out: string
  emitter?: Emitter
}

/**
 * Bundle the current typings project into a single ambient definition.
 */
export function bundle (options: BundleOptions): Promise<InstallResult> {
  const { cwd, ambient, out } = options
  const emitter = options.emitter || new EventEmitter()

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

      return compile(tree, { cwd, name, ambient, emitter, meta: true })
    })
    .then((output: CompileResult) => {
      const path = resolve(cwd, out)

      return mkdirp(path)
        .then(() => findConfigFile(options.cwd))
        .then(path => readConfig(path))
        .then(config => {
          const {resolution} = config
          let write: Promise<any>[] = []

          if (!resolution || resolution === 'main' || resolution === 'both') {
            write.push(writeFile(join(path, 'main.d.ts'), output.main))
          }
          if (resolution && (resolution === 'browser' || resolution === 'both')) {
            write.push(writeFile(join(path, 'browser.d.ts'), output.browser))
          }

          return Promise.all(write)
        })
        .then(() => ({ tree: output.tree }))
    })
}
