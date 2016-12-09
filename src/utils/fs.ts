import * as fs from 'graceful-fs'
import extend = require('xtend')
import thenify = require('thenify')
import stripBom = require('strip-bom')
import parse = require('parse-json')
import popsicle = require('popsicle')
import popsicleStatus = require('popsicle-status')
import popsicleRetry = require('popsicle-retry')
import popsicleRewrite = require('popsicle-rewrite')
import detectIndent = require('detect-indent')
import sortKeys = require('sort-keys')
import Mkdirp = require('mkdirp')
import uniq = require('array-uniq')
import lockfile = require('lockfile')
import Rimraf = require('rimraf')
import createProxy = require('popsicle-proxy-agent')
import Throat = require('throat')
import promiseFinally from 'promise-finally'
import Touch = require('touch')
import { join, dirname } from 'path'
import { parse as parseUrl } from 'url'
import template = require('string-template')
import { CONFIG_FILE } from './config'
import { isHttp, EOL, detectEOL, normalizeEOL } from './path'
import { parseReferences, stringifyReferences } from './references'
import { ConfigJson, DependencyTree, DependencyBranch } from '../interfaces'
import rc from './rc'
import store from './store'
import debug from './debug'

const pkg = require('../../package.json')
const registryURL = parseUrl(rc.registryURL)
const throat = Throat(Promise)

export type Stats = fs.Stats

export type LockOp = (path: string, options?: lockfile.Options) => Promise<void>
export type TouchOp = (path: string, options?: Touch.Options) => Promise<void>
export type ReadFileOp = (path: string, encoding: string) => Promise<string>
export type WriteFileOp = (path: string, contents: string | Buffer) => Promise<void>
export type PathOp <T> = (path: string) => Promise<T>

export const touch: TouchOp = throat(10, thenify<string, Touch.Options, void>(Touch))
export const stat: PathOp<Stats> = throat(10, thenify(fs.stat))
export const readFile: ReadFileOp = throat(10, thenify<string, string, string>(fs.readFile))
export const writeFile: WriteFileOp = thenify<string, string | Buffer, void>(fs.writeFile)
export const mkdirp: PathOp<string> = throat(10, thenify<string, string>(Mkdirp))
export const unlink: PathOp<void> = throat(10, thenify<string, void>(fs.unlink))
export const lock: LockOp = throat(10, thenify<string, lockfile.Options, void>(lockfile.lock))
export const unlock: PathOp<void> = throat(10, thenify<string, void>(lockfile.unlock))
export const rimraf: PathOp<void> = throat(10, thenify<string, void>(Rimraf))
export const readdir: PathOp<string[]> = throat(10, thenify(fs.readdir))
export const rmdir: PathOp<void> = throat(10, thenify<string, void>(fs.rmdir))

/**
 * Remove directories until a root directory, while empty.
 */
export function rmdirUntil (path: string, until: string): Promise<void> {
  if (path === until) {
    return Promise.resolve()
  }

  return readdir(path)
    .then(files => {
      // Exit loop when files exist.
      if (files.length) {
        return
      }

      return rmdir(path)
        .then(() => rmdirUntil(dirname(path), until))
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        return
      }

      return Promise.reject<void>(err)
    })
}

/**
 * Verify a path exists and is a file.
 */
export function isFile (path: string): Promise<boolean> {
  return stat(path).then(stat => stat.isFile(), () => false)
}

/**
 * Read JSON from a path.
 */
export function readJson (path: string, allowEmpty?: boolean): Promise<any> {
  return readFile(path, 'utf8')
    .then(stripBom)
    .then(contents => parseJson(contents, path, allowEmpty))
}

/**
 * Write JSON to a file.
 */
export function writeJson (path: string, json: any, indent?: string | number, eol?: string) {
  return writeFile(path, stringifyJson(json, indent, eol))
}

/**
 * Read a configuration file.
 */
export function readConfig (path: string): Promise<ConfigJson> {
  return readJson(path, true).then(data => parseConfig(data, path))
}

/**
 * Read a configuration file from anywhere (HTTP or local).
 */
export function readConfigFrom (path: string): Promise<ConfigJson> {
  return readJsonFrom(path, true).then(data => parseConfig(data, path))
}

/**
 * Parse a config object with helpful validation.
 */
export function parseConfig (config: ConfigJson, path: string): ConfigJson {
  // TODO(blakeembrey): Validate config object.
  return config
}

/**
 * Create a proxy agent function.
 */
export const proxy = createProxy({
  proxy: rc.proxy,
  httpProxy: rc.httpProxy,
  httpsProxy: rc.httpsProxy,
  noProxy: rc.noProxy
})

/**
 * Read a file over HTTP, using a file cache and status check.
 */
export const readHttp = throat(5, function readHttp (url: string): Promise<string> {
  const { rejectUnauthorized, ca, key, cert, userAgent } = rc

  return popsicle.get({
    url,
    headers: {
      'User-Agent': template(userAgent, {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        typingsVersion: pkg.version
      })
    },
    transport: popsicle.createTransport({
      ca,
      key,
      cert,
      agent: proxy(url),
      rejectUnauthorized
    })
  })
    // Check responses are "200 OK".
    .use(popsicleStatus(200))
    // Enable URL rewrite
    .use(popsicleRewrite(rc.urlRewrites || {}))
    // Enable tracking of repeat users on the registry.
    .use(function (request, next) {
      if (request.Url.host === registryURL.host) {
        if (store.get('clientId')) {
          request.set('Typings-Client-Id', store.get('clientId'))
        }

        return next().then(function (response) {
          if (response.get('Typings-Client-Id')) {
            store.set('clientId', response.get('Typings-Client-Id'))
          }

          return response
        })
      }

      return next()
    })
    // Enable access tokens with GitHub.
    .use(function (request, next) {
      const { hostname } = request.Url

      if (rc.githubToken && (hostname === 'raw.githubusercontent.com' || hostname === 'api.github.com')) {
        request.set('Authorization', `token ${rc.githubToken}`)
      }

      return next()
    })
    // Retry failed HTTP requests.
    .use(popsicleRetry())
    // Return only the response body.
    .then(function (response) {
      debug('http response', response.toJSON())

      return response.body
    })
})

/**
 * Read a file from anywhere (HTTP or local filesystem).
 */
export function readFileFrom (from: string): Promise<string> {
  return isHttp(from) ? readHttp(from) : readFile(from, 'utf8')
}

/**
 * Read JSON from anywhere.
 */
export function readJsonFrom (from: string, allowEmpty?: boolean): Promise<any> {
  return readFileFrom(from)
    .then(stripBom)
    .then(contents => parseJson(contents, from, allowEmpty))
}

/**
 * Stringify an object as JSON for the filesystem (appends EOL).
 */
export function stringifyJson (json: any, indent?: number | string, eol: string = EOL) {
  return normalizeEOL(JSON.stringify(json, null, indent || 2), eol) + eol
}

/**
 * Parse a string as JSON.
 */
export function parseJson (contents: string, path: string, allowEmpty: boolean) {
  if (contents === '' && allowEmpty) {
    return {}
  }

  return parse(contents, null, path)
}

/**
 * Transform a file contents (read and write in a single operation).
 */
export function transformFile (path: string, transform: (contents: string) => string | Promise<string>): Promise<void> {
  function handle (contents: string) {
    return Promise.resolve(transform(contents))
      .then(contents => writeFile(path, contents))
  }

  const lockfile = `${path}.lock`
  const lockOptions = { wait: 250, retries: 25, stale: 60000 }

  const result = lock(lockfile, lockOptions)
    .then(() => {
      return readFile(path, 'utf8')
    })
    .then(
      (contents) => handle(contents),
      () => handle(undefined)
    )

  return promiseFinally(result, () => unlock(lockfile))
}

/**
 * Transform a JSON file in a single operation.
 */
export function transformJson <T> (path: string, transform: (json: T) => T, allowEmpty?: boolean) {
  return transformFile(path, (contents) => {
    const indent = contents ? detectIndent(contents).indent : undefined
    const json = contents ? parseJson(stripBom(contents), path, allowEmpty) : undefined
    const eol = contents ? detectEOL(contents) : undefined

    return Promise.resolve(transform(json))
      .then(json => stringifyJson(json, indent, eol))
  })
}

/**
 * Transform a configuration file in a single operation.
 */
export function transformConfig (cwd: string, transform: (config: ConfigJson) => ConfigJson) {
  const path = join(cwd, CONFIG_FILE)

  return transformJson<ConfigJson>(
    path,
    (config = {}) => {
      return Promise.resolve(transform(parseConfig(config, path)))
        .then(config => {
          if (config.dependencies) {
            config.dependencies = sortKeys(config.dependencies)
          }

          if (config.peerDependencies) {
            config.peerDependencies = sortKeys(config.peerDependencies)
          }

          if (config.devDependencies) {
            config.devDependencies = sortKeys(config.devDependencies)
          }

          if (config.globalDependencies) {
            config.globalDependencies = sortKeys(config.globalDependencies)
          }

          if (config.globalDevDependencies) {
            config.globalDevDependencies = sortKeys(config.globalDevDependencies)
          }

          return config
        })
    },
    true
  )
}

/**
 * Transform a `.d.ts` file with references in-place.
 */
export function transformDtsFile (path: string, transform: (typings: string[]) => string[] | Promise<string[]>) {
  const cwd = dirname(path)

  return transformFile(path, contents => {
    const typings = parseReferences(contents, cwd)

    return Promise.resolve(transform(typings))
      .then(typings => stringifyReferences(uniq(typings).sort(), cwd))
  })
}

/**
 * Convert the dependency tree into a JSON-safe structure.
 */
export function treeToJson (tree: DependencyTree) {
  return extend(tree, {
    parent: undefined,
    dependencies: dependenciesToJson(tree.dependencies),
    devDependencies: dependenciesToJson(tree.devDependencies),
    peerDependencies: dependenciesToJson(tree.peerDependencies),
    globalDependencies: dependenciesToJson(tree.globalDependencies),
    globalDevDependencies: dependenciesToJson(tree.globalDevDependencies)
  })
}

/**
 * Convert a map of dependencies to JSON-safe structures.
 */
export function dependenciesToJson (dependencies: DependencyBranch) {
  const json: DependencyBranch = {}
  const keys = Object.keys(dependencies)

  // Omit empty dependency objects.
  if (keys.length === 0) {
    return
  }

  for (const key of keys) {
    json[key] = treeToJson(dependencies[key])
  }

  return json
}
