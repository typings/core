import * as fs from 'graceful-fs'
import Promise = require('any-promise')
import thenify = require('thenify')
import stripBom = require('strip-bom')
import parse = require('parse-json')
import popsicle = require('popsicle')
import popsicleStatus = require('popsicle-status')
import popsicleRetry = require('popsicle-retry')
import detectIndent = require('detect-indent')
import sortKeys = require('sort-keys')
import mdp = require('mkdirp')
import uniq = require('array-uniq')
import lockfile = require('lockfile')
import rmrf = require('rimraf')
import popsicleProxy = require('popsicle-proxy-agent')
import promiseFinally from 'promise-finally'
import tch = require('touch')
import { join, dirname } from 'path'
import { parse as parseUrl } from 'url'
import template = require('string-template')
import { CONFIG_FILE } from './config'
import { isHttp, EOL, detectEOL, normalizeEOL } from './path'
import { parseReferences, stringifyReferences } from './references'
import { ConfigJson } from '../interfaces'
import rc from './rc'
import store from './store'
import debug from './debug'

const pkg = require('../../package.json')
const registryURL = parseUrl(rc.registryURL)

export type Stats = fs.Stats

export const touch: (path: string, options?: tch.Options) => Promise<void> = thenify<string, tch.Options, void>(tch)
export const stat: (path: string) => Promise<Stats> = thenify(fs.stat)
export const readFile: (path: string, encoding: string) => Promise<string> = thenify<string, string, string>(fs.readFile)
export const writeFile: (path: string, contents: string | Buffer) => Promise<void> = thenify<string, string | Buffer, void>(fs.writeFile)
export const mkdirp: (path: string) => Promise<string> = thenify<string, string>(mdp)
export const unlink: (path: string) => Promise<void> = thenify<string, void>(fs.unlink)
export const lock: (path: string, options?: lockfile.Options) => Promise<void> = thenify<string, lockfile.Options, void>(lockfile.lock)
export const unlock: (path: string) => Promise<void> = thenify<string, void>(lockfile.unlock)
export const rimraf: (path: string) => Promise<void> = thenify<string, void>(rmrf)

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
 * Read a file over HTTP, using a file cache and status check.
 */
export function readHttp (url: string): Promise<string> {
  const { proxy, httpProxy, httpsProxy, noProxy, rejectUnauthorized, ca, key, cert, userAgent } = rc

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
    options: {
      ca,
      key,
      cert,
      rejectUnauthorized
    },
    use: [
      popsicle.plugins.headers(),
      popsicle.plugins.unzip(),
      popsicle.plugins.concatStream('string')
    ]
  })
    // Enable HTTP(s) proxies and environment variable support.
    .use(popsicleProxy({ proxy, httpProxy, httpsProxy, noProxy }))
    // Retry failed HTTP requests.
    .use(popsicleRetry({ maxRetries: 3, retryDelay: 3000 }))
    // Check responses are "200 OK".
    .use(popsicleStatus(200))
    // Request "middleware".
    .use(function (self) {
      const { hostname } = self.Url

      // Enable tracking of repeat users on the registry.
      if (self.Url.host === registryURL.host) {
        if (store.get('clientId')) {
          self.before(function (req) {
            req.set('Typings-Client-Id', store.get('clientId'))
          })
        } else {
          self.after(function (res) {
            store.set('clientId', res.get('Typings-Client-Id'))
          })
        }
      }

      // Enable access tokens with GitHub.
      if (rc.githubToken && (hostname === 'raw.githubusercontent.com' || hostname === 'api.github.com')) {
        self.before(function (req) {
          req.set('Authorization', `token ${rc.githubToken}`)
        })
      }
    })
    // Return only the response body.
    .then(response => {
      debug('http response', response.toJSON())

      return response.body
    })
}

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
    const json = contents ? parseJson(contents, path, allowEmpty) : undefined
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

          if (config.ambientDependencies) {
            config.ambientDependencies = sortKeys(config.ambientDependencies)
          }

          if (config.ambientDevDependencies) {
            config.ambientDevDependencies = sortKeys(config.ambientDevDependencies)
          }

          return config
        })
    },
    true)
}

export function transformDtsFile (path: string, transform: (typings: string[]) => string[]) {
  const cwd = dirname(path)

  return transformFile(path, contents => {
    const typings = parseReferences(contents, cwd)

    return Promise.resolve(transform(typings))
      .then(typings => stringifyReferences(uniq(typings).sort(), cwd))
  })
}
