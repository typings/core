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
  meta?: any
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
  src: string
  raw: string
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
  on (event: string, listener: Function): this

  emit (event: 'reference', e: ReferenceEvent): boolean
  emit (event: 'resolve', e: ResolveEvent): boolean
  emit (event: 'resolved', e: ResolvedEvent): boolean
  emit (event: string, ...args: any[]): boolean
}

/**
 * Emit stripped references.
 */
export interface ReferenceEvent {
  name: string
  path: string
  raw: string
  src: string
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