import invariant = require('invariant')
import Promise = require('any-promise')
import { stringify } from 'querystring'
import { resolve } from 'url'
import pick = require('object.pick')
import { readJsonFrom } from '../utils/fs'
import rc from '../utils/rc'

/**
 * Valid sources in the registry.
 */
export const VALID_SOURCES: { [source: string]: string } = {
  dt: 'DefinitelyTyped',
  npm: 'NPM',
  github: 'GitHub',
  bower: 'Bower',
  common: 'Common',
  shared: 'Shared',
  lib: 'Library',
  env: 'Environment',
  global: 'Global'
}

/**
 * Query parameters used for searching.
 */
export interface SearchOptions {
  query?: string
  name?: string
  source?: string
  offset?: string
  limit?: string
  ambient?: boolean
  order?: string
  sort?: string
}

/**
 * API search query response.
 */
export interface SearchResults {
  total: number
  results: Array<{
    name: string
    source: string
    homepage: string
    description: string
    updated: string
    versions: number
  }>
}

/**
 * Search the typings registry.
 */
export function search (options: SearchOptions): Promise<SearchResults> {
  if (options.source && !isValidSource(options.source)) {
    return Promise.reject(new TypeError(`Invalid registry source: ${options.source}`))
  }

  const query = pick(options, ['query', 'name', 'source', 'offset', 'limit', 'ambient', 'order', 'sort'])

  return readJsonFrom(resolve(rc.registryURL, `search?${stringify(query)}`))
}

/**
 * A project version from the registry.
 */
export interface ProjectVersion {
  version: string
  description: string
  compiler: string
  location: string
}

/**
 * Get the latest matching registry version.
 */
export function getVersion (source: string, name: string, version?: string): Promise<ProjectVersion> {
  if (!isValidSource(source)) {
    return Promise.reject(new TypeError(`Invalid registry source: ${source}`))
  }

  const sourceParam = encodeURIComponent(source)
  const nameParam = encodeURIComponent(name)
  const versionParam = encodeURIComponent(version || '*')

  return readJsonFrom(resolve(rc.registryURL, `entries/${sourceParam}/${nameParam}/versions/${versionParam}/latest`))
}

/**
 * Get matching registry tag.
 */
export function getTag (source: string, name: string, tag: string): Promise<ProjectVersion> {
  if (!isValidSource(source)) {
    return Promise.reject(new TypeError(`Invalid registry source: ${source}`))
  }

  const sourceParam = encodeURIComponent(source)
  const nameParam = encodeURIComponent(name)
  const tagParam = encodeURIComponent(tag)

  return readJsonFrom(resolve(rc.registryURL, `entries/${sourceParam}/${nameParam}/tags/${tagParam}`))
}

/**
 * Source validity check.
 */
function isValidSource (source: string): boolean {
  return VALID_SOURCES.hasOwnProperty(source)
}
