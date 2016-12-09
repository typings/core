import { EventEmitter } from 'events'
import { Emitter, DependencyTree } from './interfaces'
import { resolveTypeDependencies } from './lib/dependencies'

export interface ListOptions {
  cwd: string
  production?: boolean
  emitter?: Emitter
}

/**
 * Generate a dependency tree of the project.
 */
export function list (options: ListOptions): Promise<DependencyTree> {
  const { cwd } = options
  const dev = !options.production
  const emitter = options.emitter || new EventEmitter()

  // TODO: Make this list locally.
  return resolveTypeDependencies({ cwd, global: true, dev, emitter })
}
