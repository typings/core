import extend = require('xtend')
import pick = require('object.pick')
import { stringify } from 'querystring'
import { resolve } from 'url'
import { readJsonFrom } from './utils/fs'
import rc from './utils/rc'

/**
 * Query parameters used for searching.
 */
export interface SearchOptions {
  query?: string
  name?: string
  source?: string
  offset?: string
  limit?: string
  order?: string
  sort?: string
}

/**
 * The result from searching the API.
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
 * Remove `null` keys before searching.
 */
function tidyParams <T extends any> (params: T): T {
  const result = extend(params)

  // Loop over and delete empty values.
  for (const key of Object.keys(result)) {
    if (result[key] == null) {
      delete result[key]
    }
  }

  return result
}

/**
 * Search the registry for typings.
 */
export function search (options: SearchOptions = {}): Promise<SearchResults> {
  const query = tidyParams(pick(options, [
    'query',
    'name',
    'source',
    'offset',
    'limit',
    'order',
    'sort'
  ]))

  return readJsonFrom(resolve(rc.registryURL, `search?${stringify(query)}`))
}
