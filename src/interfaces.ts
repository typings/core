import { EventEmitter } from 'events'

/**
 * A dependency string is a string that maps to a resource. For example,
 * "file:foo/bar" or "npm:typescript".
 */
export type DependencyString = string

/**
 * Override map for file lookups.
 */
export interface Overrides {
  [dependency: string]: string
}

/**
 * Browser field overrides like NPM.
 */
export type Browser = string | Overrides

/**
 * The JSON configuration format.
 */
export interface ConfigJson {
  // Typing information.
  main?: string | boolean
  browser?: Browser
  typings?: string | boolean
  browserTypings?: string | Browser
  version?: string
  files?: string[]
  ambient?: boolean

  // Meta information.
  name?: string
  author?: string
  description?: string
  bugs?: string
  homepage?: string

  // Dependencies.
  dependencies?: Dependencies
  devDependencies?: Dependencies
  peerDependencies?: Dependencies
  ambientDependencies?: Dependencies
  ambientDevDependencies?: Dependencies
}

/**
 * Dependencies can be an array for graceful degradation over services.
 */
export interface Dependencies {
  [name: string]: DependencyString
}

/**
 * Parsed dependency specification.
 */
export interface Dependency {
  type: string
  raw: string
  location: string
  meta: {
    // Packages.
    name?: string
    // Common.
    path?: string
    // Git-based.
    org?: string
    repo?: string
    sha?: string
    // Registry.
    version?: string
    tag?: string
    source?: string
  }
}

/**
 * Used for generating the structure of a tree.
 */
export interface DependencyTree {
  name?: string
  version?: string
  main?: string
  browser?: Browser
  typings?: string
  browserTypings?: Browser
  parent?: DependencyTree
  files?: string[]
  src: string
  raw: string
  ambient: boolean
  dependencies: DependencyBranch
  devDependencies: DependencyBranch
  peerDependencies: DependencyBranch
  ambientDependencies: DependencyBranch
  ambientDevDependencies: DependencyBranch
}

/**
 * Map of dependency trees.
 */
export interface DependencyBranch {
  [name: string]: DependencyTree
}

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
  on (event: string, listener: Function): this

  emit (event: 'reference', e: ReferenceEvent): boolean
  emit (event: 'resolve', e: ResolveEvent): boolean
  emit (event: 'resolved', e: ResolvedEvent): boolean
  emit (event: 'enoent', e: EnoentEvent): boolean
  emit (event: 'compile', e: CompileEvent): boolean
  emit (event: 'compiled', e: CompiledEvent): boolean
  emit (event: 'hastypings', e: HasTypingsEvent): boolean
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