import { Browser } from './config'

/**
 * Parsed dependency specification.
 */
export interface Dependency {
  type: string
  raw: string
  location?: string
  meta: DependencyMeta
}

/**
 * Dependency metadata.
 */
export interface DependencyMeta {
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
  postmessage?: string
  type?: string
  src: string
  raw: string
  global: boolean
  dependencies: DependencyBranch
  devDependencies: DependencyBranch
  peerDependencies: DependencyBranch
  globalDependencies: DependencyBranch
  globalDevDependencies: DependencyBranch
}

/**
 * Map of dependency trees.
 */
export interface DependencyBranch {
  [name: string]: DependencyTree
}
