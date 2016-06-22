/**
 * The JSON configuration format.
 */
export interface ConfigJson {
  /**
   * The entry point to the definition (canonical to `"main"` in NPM's `package.json`).
   */
  main?: string
  /**
   * A string, or map of paths, to override during resolution. See spec:
   * https://github.com/defunctzombie/package-browser-field-spec
   */
  browser?: Browser
  /**
   * The semver range this definition is typed for.
   */
  version?: string
  /**
   * Homepage url of the source package.
   */
  homepage?: string
  /**
   * Map of resolutions to install.
   */
  resolution?: string | ResolutionMap
  /**
   * Used as an alternative or to complement `main`, specify an array of files that are
   * exported but aren't already part of the resolution from `main`.
   */
  files?: string[]
  /**
   * Denote that this definition _must_ be installed as global.
   */
  global?: boolean
  /**
   * A message to emit to users after typings installation.
   */
  postmessage?: string
  /**
   * The name of the definition.
   */
  name?: string
  /**
   * A map of dependencies required by the project.
   */
  dependencies?: Dependencies
  /**
   * A map of dependencies required by the project during development.
   */
  devDependencies?: Dependencies
  /**
   * A map of dependencies expected in the parent project for this dependency to work.
   */
  peerDependencies?: Dependencies
  /**
   * A map of global dependencies required by the project.
   */
  globalDependencies?: Dependencies
  /**
   * A map of global dependencies required by the project during development.
   */
  globalDevDependencies?: Dependencies
}

/**
 * A dependency string is a string that maps to a resource. For example,
 * "file:foo/bar" or "npm:typescript".
 */
export type DependencyString = string

/**
 * Browser field overrides like NPM.
 */
export type Browser = string | Overrides

/**
 * Override map for file lookups.
 */
export interface Overrides {
  [dependency: string]: string
}

/**
 * Dependencies can be an array for graceful degradation over services.
 */
export interface Dependencies {
  [name: string]: DependencyString
}

/**
 * A map of installation resolutions.
 */
export interface ResolutionMap {
  main?: string
  browser?: string
  [resolution: string]: string
}
