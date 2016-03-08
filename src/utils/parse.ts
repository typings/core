import invariant = require('invariant')
import { parse, format, resolve as resolveUrl } from 'url'
import { normalize, join, basename, dirname } from 'path'
import { Dependency, DependencyExpression } from '../interfaces'
import { CONFIG_FILE } from './config'
import { isDefinition, normalizeSlashes, inferDefinitionName, sanitizeDefinitionName } from './path'
import rc from './rc'

/**
 * Parse the git host options from the raw string.
 */
function gitFromPath (src: string) {
  const index = src.indexOf('#')
  const sha = index === -1 ? 'master' : src.substr(index + 1)
  const segments = index === -1 ? src.split('/') : src.substr(0, index).split('/')
  const org = segments.shift()
  const repo = segments.shift()
  let path = segments.join('/')

  // Automatically look for the config file in the root.
  if (segments.length === 0) {
    path = CONFIG_FILE
  } else if (!isDefinition(path) && segments[segments.length - 1] !== CONFIG_FILE) {
    path += `/${CONFIG_FILE}`
  }

  return { org, repo, path, sha }
}

/**
 * Split the protocol from the rest of the string.
 */
function splitProtocol (raw: string): [string, string] {
  const index = raw.indexOf(':')

  if (index === -1) {
    return [undefined, raw]
  }

  return [raw.substr(0, index), normalizeSlashes(raw.substr(index + 1))]
}

/**
 * Parse the dependency string.
 */
export function parseDependency (raw: string): Dependency {
  const [type, src] = splitProtocol(raw)

  // `file:path/to/file.d.ts`
  if (type === 'file') {
    const location = normalize(src)
    const filename = basename(location)

    invariant(
      filename === CONFIG_FILE || isDefinition(filename),
      `Only ".d.ts" and "${CONFIG_FILE}" files are supported`
    )

    return {
      raw,
      type,
      meta: {
        path: location
      },
      location
    }
  }

  // `bitbucket:org/repo/path#sha`
  if (type === 'github') {
    const meta = gitFromPath(src)
    const { org, repo, path, sha } = meta
    let location = `https://raw.githubusercontent.com/${org}/${repo}/${sha}/${path}`

    if (rc.githubToken) {
      location += `?token=${encodeURIComponent(rc.githubToken)}`
    }

    return {
      raw,
      meta,
      type,
      location
    }
  }

  // `bitbucket:org/repo/path#sha`
  if (type === 'bitbucket') {
    const meta = gitFromPath(src)
    const { org, repo, path, sha } = meta
    const location = `https://bitbucket.org/${org}/${repo}/raw/${sha}/${path}`

    return {
      raw,
      meta,
      type,
      location
    }
  }

  // `npm:dependency`, `npm:@scoped/dependency`
  if (type === 'npm') {
    const parts = src.split('/')
    const isScoped = parts.length > 0 && parts[0].charAt(0) === '@'
    const hasPath = isScoped ? parts.length > 2 : parts.length > 1

    if (!hasPath) {
      parts.push('package.json')
    }

    return {
      raw,
      type: 'npm',
      meta: {
        name: isScoped ? parts.slice(0, 2).join('/') : parts[0],
        path: join(...parts.slice(isScoped ? 2 : 1))
      },
      location: join(...parts)
    }
  }

  // `bower:dependency`
  if (type === 'bower') {
    const parts = src.split('/')

    if (parts.length === 1) {
      parts.push('bower.json')
    }

    return {
      raw,
      type: 'bower',
      meta: {
        name: parts[0],
        path: join(...parts.slice(1))
      },
      location: join(...parts)
    }
  }

  // `http://example.com/foo.d.ts`
  if (type === 'http' || type === 'https') {
    return {
      raw,
      type,
      meta: {},
      location: raw
    }
  }

  // `registry:source/module#tag`, `registry:source/module@version`
  if (type === 'registry') {
    const parts = /^([^\/]+)\/(.+?)(?:@(.*?)|#(.*?))?$/.exec(src)

    if (parts == null) {
      throw new TypeError(`Unable to parse: ${raw}`)
    }

    const [, source, name, version, tag] = parts

    if (version != null && tag != null) {
      throw new TypeError(`Unable to use tag and version together: ${raw}`)
    }

    const prefix = `/entries/${encodeURIComponent(source)}/${encodeURIComponent(name)}`
    const path = tag ? `${prefix}/tags/${encodeURIComponent(tag)}` : `${prefix}/versions/${encodeURIComponent(version || '*')}/latest`

    return {
      raw,
      type,
      meta: {
        source,
        name,
        version,
        tag
      },
      location: resolveUrl(rc.registryURL, path)
    }
  }

  throw new TypeError(`Unknown dependency: ${raw}`)
}

/**
 * Resolve a path relative to the raw string.
 */
export function resolveDependency (raw: string, path: string) {
  const { type, meta, location } = parseDependency(raw)

  if (type === 'github' || type === 'bitbucket') {
    const { org, repo, sha } = meta
    const resolvedPath = normalizeSlashes(join(dirname(meta.path), path))

    return `${type}:${org}/${repo}/${resolvedPath}${sha === 'master' ? '' : '#' + sha}`
  }

  if (type === 'npm' || type === 'bower') {
    const resolvedPath = normalizeSlashes(join(dirname(meta.path), path))

    return `${type}:${meta.name}/${resolvedPath}`
  }

  if (type === 'http' || type === 'https') {
    return resolveUrl(location, path)
  }

  if (type === 'file') {
    return `file:${normalizeSlashes(join(location, path))}`
  }

  throw new TypeError(`Unable to resolve dependency from "${raw}"`)
}

/**
 * Parse and expand the CLI dependency expression.
 */
export function parseDependencyRaw (raw: string, options: { ambient?: boolean }): DependencyExpression {
  const [, overrideName, scheme, registry] = /^(?:([^=!:#]+)=)?(?:([\w]+\:.+)|((?:[\w]+\!)?.+))$/.exec(raw)

  const dependency = scheme ? parseDependency(scheme) : parseRegistryRaw(registry, options)
  const name = overrideName || dependency.meta.name

  return {
    name,
    dependency
  }
}

/**
 * Parse the registry dependency string.
 */
export function parseRegistryRaw (raw: string, options: { ambient?: boolean }) {
  if (raw === void 0) return parseDependency('')

  const indexOf = raw.indexOf('!')
  let source = options.ambient ? rc.defaultAmbientSource : rc.defaultSource
  let name: string

  if (indexOf === -1) {
    name = raw
  } else {
    source = raw.substr(0, indexOf)
    name = raw.substr(indexOf + 1)
  }

  return parseDependency(`registry:${source}/${name}`)
}
