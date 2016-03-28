import { resolve, dirname, relative, extname, join, sep } from 'path'
import { resolve as resolveUrl, parse as parseUrl, format as formatUrl } from 'url'
import { TYPINGS_DIR, DTS_MAIN_FILE, DTS_BROWSER_FILE } from './config'
import isAbsolute = require('is-absolute')

const mainTypingsDir = join(TYPINGS_DIR, 'main/definitions')
const browserTypingsDir = join(TYPINGS_DIR, 'browser/definitions')
const ambientMainTypingsDir = join(TYPINGS_DIR, 'main/ambient')
const ambientBrowserTypingsDir = join(TYPINGS_DIR, 'browser/ambient')

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

export interface TypingsLocationResult extends LocationResult {
  typings: string
}

/**
 * Get definition installation paths.
 */
export function getTypingsLocation (options: { cwd: string }): TypingsLocationResult {
  const typings = join(options.cwd, TYPINGS_DIR)
  const main = join(typings, DTS_MAIN_FILE)
  const browser = join(typings, DTS_BROWSER_FILE)

  return { main, browser, typings }
}

export interface LocationOptions {
  cwd: string
  name: string
  ambient: boolean
}

export interface LocationResult {
  main: string
  browser: string
}

export interface DependencyLocationResult extends LocationResult {
  mainDir: string
  browserDir: string
}

/**
 * Return the dependency output locations based on definition options.
 */
export function getDependencyLocation (options: LocationOptions): DependencyLocationResult {
  const mainDir = options.ambient ? ambientMainTypingsDir : mainTypingsDir
  const browserDir = options.ambient ? ambientBrowserTypingsDir : browserTypingsDir

  const main = join(options.cwd, mainDir, options.name, 'index.d.ts')
  const browser = join(options.cwd, browserDir, options.name, 'index.d.ts')

  return { mainDir, browserDir, main, browser }
}

/**
 * Return information about the typings path.
 */
export function getInfoFromDependencyLocation (path: string, options: { cwd: string }) {
  const parts = relative(options.cwd, path).split(sep)

  return {
    path: path,
    browser: parts[0] === 'browser',
    ambient: parts[1] === 'ambient',
    name: parts.slice(2, -1).join('/')
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
