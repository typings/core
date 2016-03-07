import Promise = require('any-promise')
import { resolve as resolveUrl } from 'url'
import { readJsonFrom } from './utils/fs'
import { parseRegistryRaw } from './utils/parse'
import rc from './utils/rc'

export interface ViewOptions {
  ambient?: boolean
}

export function viewEntry (raw: string, options: ViewOptions = {}) {
  return new Promise((resolve) => {
    const dependency = parseRegistryRaw(raw, options)

    return resolve(readJsonFrom(dependency.location))
  })
}

export function viewVersions (raw: string, options: ViewOptions = {}) {
  return new Promise((resolve) => {
    const { meta } = parseRegistryRaw(raw, options)

    return resolve(readJsonFrom(resolveUrl(rc.registryURL, `entries/${encodeURIComponent(meta.source)}/${encodeURIComponent(meta.name)}/versions/${encodeURIComponent(meta.version || '*')}`)))
  })
}