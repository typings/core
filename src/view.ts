import Promise = require('any-promise')
import { resolve as resolveUrl } from 'url'
import { readJsonFrom } from './utils/fs'
import { expandRegistry, parseDependency } from './utils/parse'
import rc from './utils/rc'

export interface ViewOptions {
  ambient?: boolean
}

export function viewEntry (raw: string, options: ViewOptions = {}) {
  return new Promise((resolve) => {
    const { meta } = parseDependency(expandRegistry(raw, options))
    const path = `entries/${encodeURIComponent(meta.source)}/${encodeURIComponent(meta.name)}`

    return resolve(readJsonFrom(resolveUrl(rc.registryURL, path)))
  })
}

export function viewVersions (raw: string, options: ViewOptions = {}) {
  return new Promise((resolve) => {
    const { meta } = parseDependency(expandRegistry(raw, options))
    let path = `entries/${encodeURIComponent(meta.source)}/${encodeURIComponent(meta.name)}/versions`

    if (meta.version) {
      path += `/${encodeURIComponent(meta.version)}`
    }

    return resolve(readJsonFrom(resolveUrl(rc.registryURL, path)))
  })
}