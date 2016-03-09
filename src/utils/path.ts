import { resolve, dirname, basename, relative, extname, join } from 'path'
import { resolve as resolveUrl, parse as parseUrl } from 'url'
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
 * Infer the definition name from a location string.
 */
export function inferDefinitionName (location: string) {
  if (isDefinition(location)) {
    let pathname = location

    if (isHttp(location)) {
      pathname = parseUrl(location).pathname
    }

    return sanitizeDefinitionName(basename(pathname, '.d.ts'))
  }
}

/**
 * Attempt to sanitize the definition name (stripping "typings", etc).
 */
export function sanitizeDefinitionName (name: string) {
  if (name == null) {
    return name
  }

  return name.replace(/^(?:typings|typed)\-|\-(?:typings|typed)$/, '')
}

/**
 * Resolve a path directly from another.
 */
export function resolveFrom (from: string, to: string) {
  if (isHttp(to)) {
    return to
  }

  return isHttp(from) ? resolveUrl(from, to) : resolve(dirname(from), to)
}

/**
 * Make a path relative to another.
 */
export function relativeTo (from: string, to: string): string {
  if (isHttp(from)) {
    if (isHttp(to)) {
      const fromUrl = parseUrl(from)
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

    return to
  }

  return relative(dirname(from), to)
}

/**
 * Append `.d.ts` to a path.
 */
export function toDefinition (name: string) {
  return `${name}.d.ts`
}

/**
 * Remove `.d.ts` from a path.
 */
export function fromDefinition (name: string) {
  return name.replace(/\.d\.ts$/, '')
}

/**
 * Normalize a path to `.d.ts` file.
 */
export function normalizeToDefinition (path: string) {
  if (isDefinition(path)) {
    return path
  }

  const ext = extname(path)

  return toDefinition(ext ? path.slice(0, -ext.length) : path)
}

/**
 * Get definition installation paths.
 */
export function getTypingsLocation (options: { cwd: string }) {
  const typingsDir = join(options.cwd, TYPINGS_DIR)
  const mainDtsFile = join(typingsDir, DTS_MAIN_FILE)
  const browserDtsFile = join(typingsDir, DTS_BROWSER_FILE)

  return { typingsDir, mainDtsFile, browserDtsFile }
}

/**
 * Options for interacting with dependencies.
 */
export interface DefinitionOptions {
  cwd: string
  name: string
  ambient?: boolean
}

/**
 * Return the dependency output locations based on definition options.
 */
export function getDependencyLocation (options: DefinitionOptions) {
  const mainDir = options.ambient ? ambientMainTypingsDir : mainTypingsDir
  const browserDir = options.ambient ? ambientBrowserTypingsDir : browserTypingsDir

  const { typingsDir, mainDtsFile, browserDtsFile } = getTypingsLocation(options)

  const mainPath = join(options.cwd, mainDir, options.name)
  const browserPath = join(options.cwd, browserDir, options.name)
  const mainFile = join(mainPath, 'index.d.ts')
  const browserFile = join(browserPath, 'index.d.ts')

  return {
    mainFile,
    browserFile,
    mainPath,
    browserPath,
    mainDtsFile,
    browserDtsFile
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