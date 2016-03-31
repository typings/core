import { EventEmitter } from 'events'

import { Dependencies } from './config'
import { DependencyTree } from './dependencies'

/**
 * Custom event emitter for tracking Typings changes.
 */
export interface Emitter extends EventEmitter {
  on (event: 'reference', listener: (e: ReferenceEvent) => any): this
  on (event: 'resolve', listener: (e: ResolveEvent) => any): this
  on (event: 'resolved', listener: (e: ResolvedEvent) => any): this
  on (event: 'enoent', listener: (e: EnoentEvent) => any): this
  on (event: 'compile', listener: (e: CompileEvent) => any): this
  on (event: 'compiled', listener: (e: CompiledEvent) => any): this
  on (event: 'hastypings', listener: (e: HasTypingsEvent) => any): this
  on (event: 'postmessage', listener: (e: PostMessageEvent) => any): this
  on (event: 'ambientdependencies', listener: (e: AmbientDependenciesEvent) => any): this
  on (event: 'badlocation', listener: (e: BadLocationEvent) => any): this
  on (event: 'deprecated', listener: (e: DeprecatedEvent) => any): this
  on (event: string, listener: Function): this

  emit (event: 'reference', e: ReferenceEvent): boolean
  emit (event: 'resolve', e: ResolveEvent): boolean
  emit (event: 'resolved', e: ResolvedEvent): boolean
  emit (event: 'enoent', e: EnoentEvent): boolean
  emit (event: 'compile', e: CompileEvent): boolean
  emit (event: 'compiled', e: CompiledEvent): boolean
  emit (event: 'hastypings', e: HasTypingsEvent): boolean
  emit (event: 'postmessage', e: PostMessageEvent): boolean
  emit (event: 'ambientdependencies', e: AmbientDependenciesEvent): boolean
  emit (event: 'badlocation', e: BadLocationEvent): boolean
  emit (event: 'deprecated', e: DeprecatedEvent): boolean
  emit (event: string, ...args: any[]): boolean
}

/**
 * Emit stripped references.
 */
export interface ReferenceEvent {
  name: string
  path: string
  tree: DependencyTree
  browser: boolean
  reference: string
}

/**
 * Emit when resolving a dependency.
 */
export interface ResolveEvent {
  src: string
  raw: string
  parent?: DependencyTree
}

/**
 * Emit when the dependency is resolved.
 */
export interface ResolvedEvent extends ResolveEvent {
  tree: DependencyTree
}

/**
 * Emitted when a non-critical file is missing.
 */
export interface EnoentEvent {
  path: string
}

/**
 * Emit when a path is being compiled.
 */
export interface CompileEvent {
  name: string
  path: string
  tree: DependencyTree
  browser: boolean
}

/**
 * Emit when a path is compiled.
 */
export interface CompiledEvent extends CompileEvent {
  contents: string
}

/**
 * Emit a "hastypings" event when native typings exist during install.
 */
export interface HasTypingsEvent {
  source: string
  name: string
  path: string
  typings: string
}

/**
 * Message emitted from a module after installation.
 */
export interface PostMessageEvent {
  name: string
  message: string
}

/**
 * Emits known ambient module dependencies by top-level Typings.
 */
export interface AmbientDependenciesEvent {
  name: string
  raw: string
  dependencies: Dependencies
}

/**
 * Emitted when a known mutable source is being installed.
 */
export interface BadLocationEvent {
  type: string
  raw: string
  location: string
}

/**
 * Emit a deprecation warning.
 */
export interface DeprecatedEvent {
  raw: string
  date: Date
  parent: DependencyTree
}
