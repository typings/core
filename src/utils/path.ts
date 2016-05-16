import { resolve, dirname, relative, extname, join, sep } from 'path'
import { resolve as resolveUrl, parse as parseUrl, format as formatUrl } from 'url'
import isAbsolute = require('is-absolute')
import { DEFAULT_TYPINGS_DIR } from './config'
import { ResolutionMap } from '../interfaces'

/**
 * Consistent EOL behaviour.
 */
export const EOL = '\n'

/**
 * Check if a path looks like a HTTP url.
 */
export function isHttp (url: string) {
  return /^https?\:\/\//i.test(url)
}

/**
 * Check if a path looks like a definition file.
 */
export function isDefinition (path: string): boolean {
  if (isHttp(path)) {
    return isDefinition(parseUrl(path).pathname)
  }

  return /\.d\.ts$/.test(path)
}

/**
 * Check if a path looks like a module name.
 */
export function isModuleName (value: string) {
  return !isHttp(value) && !isAbsolute(value) && value.charAt(0) !== '.'
}

/**
 * Normalize Windows slashes.
 */
export function normalizeSlashes (path: string) {
  return path.replace(/\\/g, '/')
}

/**
 * Resolve a path directly from another.
 */
export function resolveFrom (from: string, to: string) {
  // Replace the entire path.
  if (isHttp(to)) {
    return to
  }

  // Resolve relative HTTP requests.
  if (isHttp(from)) {
    const url = parseUrl(from)
    url.pathname = resolveUrl(url.pathname, to)
    return formatUrl(url)
  }

  return resolve(dirname(from), to)
}

/**
 * Make a path relative to another.
 */
export function relativeTo (from: string, to: string): string {
  if (isHttp(from)) {
    const fromUrl = parseUrl(from)

    if (isHttp(to)) {
      const toUrl = parseUrl(to)

      if (toUrl.auth !== fromUrl.auth || toUrl.host !== fromUrl.host) {
        return to
      }

      let relativeUrl = relativeTo(fromUrl.pathname, toUrl.pathname)

      if (toUrl.search) {
        relativeUrl += toUrl.search
      }

      if (toUrl.hash) {
        relativeUrl += toUrl.hash
      }

      return relativeUrl
    }

    return relativeTo(fromUrl.pathname, to)
  }

  return relative(dirname(from), to)
}

/**
 * Append `.d.ts` to a path.
 */
export function toDefinition (path: string) {
  if (isHttp(path)) {
    const url = parseUrl(path)
    url.pathname = toDefinition(url.pathname)
    return formatUrl(url)
  }

  return `${path}.d.ts`
}

/**
 * Remove `.d.ts` from a path.
 */
export function pathFromDefinition (path: string): string {
  if (isHttp(path)) {
    return pathFromDefinition(parseUrl(path).pathname)
  }

  return path.replace(/\.d\.ts$/, '')
}

/**
 * Normalize a path to `.d.ts` file.
 */
export function normalizeToDefinition (path: string) {
  if (isDefinition(path)) {
    return path
  }

  if (isHttp(path)) {
    const url = parseUrl(path)
    url.pathname = normalizeToDefinition(path)
    return formatUrl(url)
  }

  const ext = extname(path)

  return toDefinition(ext ? path.slice(0, -ext.length) : path)
}

/**
 * Get definition installation paths.
 */
export function getDefinitionPath (path: string): string {
  return join(path, 'index.d.ts')
}

export interface LocationOptions {
  name: string
  path: string
  ambient: boolean
}

export interface DependencyLocationResult {
  definition: string
  directory: string
  config: string
}

/**
 * Return the dependency output locations based on definition options.
 */
export function getDependencyPath (options: LocationOptions): DependencyLocationResult {
  const type = options.ambient ? 'globals' : 'modules'

  const directory = join(options.path, type, options.name)
  const definition = getDefinitionPath(directory)
  const config = join(directory, 'typings.json')

  return { directory, definition, config }
}

/**
 * Return information about the typings path.
 */
export function getInfoFromDependencyLocation (location: string, bundle: string) {
  const parts = relativeTo(bundle, location).split(sep)

  return {
    location,
    ambient: parts[0] === 'globals',
    name: parts.slice(1, -1).join('/')
  }
}

/**
 * Detect the EOL character of a string.
 */
export function detectEOL (contents: string) {
  const match = contents.match(/\r\n|\r|\n/)
  return match ? match[0] : undefined
}

/**
 * Replace new line characters globally.
 */
export function normalizeEOL (contents: string, eol: string) {
  return contents.replace(/\r\n|\r|\n/g, eol)
}

/**
 * Generate a resolved locations map.
 */
export function normalizeResolutions (resolutions: string | ResolutionMap, options: { cwd: string }): ResolutionMap {
  const resolutionMap: ResolutionMap = {}

  if (typeof resolutions === 'object') {
    for (const type of Object.keys(resolutions)) {
      resolutionMap[type] = join(options.cwd, resolutions[type])
    }
  } else if (typeof resolutions === 'string') {
    resolutionMap.main = join(options.cwd, resolutions)
  } else {
    resolutionMap.main = join(options.cwd, DEFAULT_TYPINGS_DIR)
  }

  return resolutionMap
}
