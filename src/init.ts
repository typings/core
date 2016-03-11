import Promise = require('any-promise')
import extend = require('xtend')
import { join, basename } from 'path'
import { ConfigJson } from './interfaces'
import { writeJson, isFile, readJson } from './utils/fs'
import { CONFIG_FILE } from './utils/config'

const TSD_JSON_FILE = 'tsd.json'
const DEFINITELYTYPED_REPO = 'DefinitelyTyped/DefinitelyTyped'
const OLD_DEFINITELYTYPED_REPO = 'borisyankov/DefinitelyTyped'

/**
 * Options for initializing a configuration.
 */
export interface InitOptions {
  cwd: string
  name?: string
  main?: string
  version?: string
  upgrade?: boolean
}

/**
 * The default configuration file to initialize.
 */
const DEFAULT_CONFIG: ConfigJson = {
  dependencies: {}
}

/**
 * The interface for `tsd.json`.
 */
interface TsdJson {
  version?: string;
  repo?: string,
  ref?: string,
  path?: string,
  bundle?: string,
  githubHost?: string,
  installed?: {
    [path: string]: {
      commit: string
    }
  }
}

/**
 * The files to check for existing names when naming a package.
 */
const PACKAGE_FILES: string[] = [
  'package.json',
  'bower.json'
]

/**
 * Update an old `tsd.json` format to the new format.
 */
function upgradeTsdJson (tsdJson: TsdJson, config?: ConfigJson): ConfigJson {
  const typingsJson = extend(config)
  let repo = tsdJson.repo || DEFINITELYTYPED_REPO

  // Rewrite the old repo name which probably hasn't been updated in `tsd.json`.
  if (repo === OLD_DEFINITELYTYPED_REPO) {
    repo = DEFINITELYTYPED_REPO
  }

  // Copy all installed modules to ambient dependencies.
  if (tsdJson.installed) {
    typingsJson.ambientDependencies = {}

    Object.keys(tsdJson.installed).forEach(function (path) {
      const dependency = tsdJson.installed[path]
      const name = basename(path, '.d.ts')
      const location = `github:${repo}/${path}#${dependency.commit}`

      typingsJson.ambientDependencies[name] = location
    })
  }

  return typingsJson
}

/**
 * Upgrade from `tsd.json`.
 */
function upgrade (options: InitOptions, config?: ConfigJson) {
  return readJson(join(options.cwd, TSD_JSON_FILE)).then(tsdJson => upgradeTsdJson(tsdJson, config))
}

/**
 * Make a smart guess of the project name from other config files.
 */
function getProjectName (options: InitOptions): Promise<string> {
  if (options.name) {
    return Promise.resolve(options.name)
  }

  return PACKAGE_FILES.reduce((promise, packageFileName) => {
    return promise.then(function (name) {
      if (name != null) {
        return name
      }

      return readJson(join(options.cwd, packageFileName))
        .then(
          (packageJson) => packageJson.name,
          () => undefined
        )
    })
  }, Promise.resolve<string>(undefined))
}

/**
 * Initialize a configuration file here.
 */
export function init (options: InitOptions) {
  const path = join(options.cwd, CONFIG_FILE)
  const { main, version } = options

  return isFile(path)
    .then<ConfigJson>(exists => {
      if (exists) {
        return Promise.reject(new TypeError(`A ${CONFIG_FILE} file already exists`))
      }
    })
    .then(() => getProjectName(options))
    .then(name => {
      if (options.upgrade) {
        return upgrade(options, { name, main, version })
      }

      return extend({ name, main, version }, DEFAULT_CONFIG)
    })
    .then(function (config) {
      return writeJson(path, config, 2)
    })
}
