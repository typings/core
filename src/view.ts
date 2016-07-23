import Promise = require('any-promise')
import { joinUrl } from './utils/path'
import { readJsonFrom } from './utils/fs'
import { expandRegistry, parseDependency } from './utils/parse'
import rc from './utils/rc'

export interface ViewOptions {}

export function viewEntry (raw: string, options: ViewOptions) {
  return new Promise((resolve) => {
    const { meta } = parseDependency(expandRegistry(raw))
    const path = `entries/${encodeURIComponent(meta.source)}/${encodeURIComponent(meta.name)}`

    return resolve(readJsonFrom(joinUrl(rc.registryURL, path)))
  })
}

export function viewVersions (raw: string, options: ViewOptions) {
  return new Promise((resolve) => {
    const { meta } = parseDependency(expandRegistry(raw))
    let path = `entries/${encodeURIComponent(meta.source)}/${encodeURIComponent(meta.name)}/versions`

    if (meta.version) {
      path += `/${encodeURIComponent(meta.version)}`
    }

    return resolve(readJsonFrom(joinUrl(rc.registryURL, path)))
  })
}
