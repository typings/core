import { join, dirname, sep as pathSeparator } from 'path'
import Promise = require('any-promise')
import { EventEmitter } from 'events'
import { Emitter } from './interfaces'
import { findProject, findConfigFile } from './utils/find'
import { readConfig, isFile, transformDtsFile, rimraf } from './utils/fs'
import { TYPINGS_DIR, DTS_BROWSER_FILE, DTS_MAIN_FILE } from './utils/config'
import { relativeTo, isDefinition } from './utils/path'
import { ConfigJson } from './interfaces'

const AMBIENT_TYPE_DIR = 'ambient'

export interface PruneOptions {
  cwd: string
  production?: boolean
  emitter?: Emitter
}

export function prune(options: PruneOptions): Promise<void> {
  const { cwd, production } = options
  const emitter = options.emitter || new EventEmitter()

  return Promise.all([
      findProject(cwd),
      readMasterDependencies(cwd)
  ])
    .then(([project, config]) => {
      const typingsPath = join(project, TYPINGS_DIR)

      return Promise.all([
        // Prune browser.d.ts
        pruneExtraneous({
            masterDependencies: config,
            typingsPath,
            includeDev: !production,
            dtsPath: join(typingsPath, DTS_BROWSER_FILE),
            emitter
        }),
        // Prune main.d.ts
        pruneExtraneous({
            masterDependencies: config,
            typingsPath,
            includeDev: !production,
            dtsPath: join(typingsPath, DTS_MAIN_FILE),
            emitter
        })
      ]).then(() => undefined)
    })
}

function readMasterDependencies(directory: string): Promise<ConfigJson> {
  return findConfigFile(directory)
    .then(configPath => {
      return readConfig(configPath)
    })
}

interface PruneExtraneousOptions {
  masterDependencies: ConfigJson
  typingsPath: string
  includeDev: boolean
  dtsPath: string
  emitter: Emitter
}

function pruneExtraneous(options: PruneExtraneousOptions): Promise<void> {
  const { masterDependencies, typingsPath, includeDev, dtsPath, emitter } = options

  return transformDtsFile(dtsPath, (typings: string[]): Promise<string[]> => {
    // Reverse parse reference paths into dependency info
    const dependencies = typings.map(typing => parseReferencePath(typingsPath, typing))

    // Separate dependencies into extraneous and used
    const [extraneous, used] = partition(dependencies, dependency => isExtraneous(masterDependencies, dependency, includeDev))

    // Parse extraneous
    return Promise.all(
      extraneous.map(dependency => pruneTypings({
        typingsDirectory: dependency.directory,
        typingsFile: dependency.path,
        typingsName: dependency.name,
        emitter
      }))
    )
      .then(() => {
        // Return used for dts
        return used.map(dependency => dependency.path)
      })
  })
}

interface DependencyInfo {
  path: string
  directory: string
  name: string
  isAmbient: boolean
}

function parseReferencePath(typingsDirectory: string, path: string): DependencyInfo {
  const relativeTypingsPath = relativeTo(typingsDirectory, path)
  const parts = relativeTypingsPath.split(pathSeparator)

  // Remove 'typings' folder
  parts.shift()

  // Remove .d.ts file
  if (isDefinition(path)) {
    parts.pop()
  }

  const [/* main|browser */ , type, ...names] = parts

  return {
    path,
    directory: dirname(path),
    name: names.join(pathSeparator),
    isAmbient: type === AMBIENT_TYPE_DIR
  }
}

function isExtraneous(masterDependencies: ConfigJson, dependency: DependencyInfo, includeDev: boolean): boolean {
  if (dependency.isAmbient) {
    if (masterDependencies.ambientDependencies &&
        masterDependencies.ambientDependencies[dependency.name]) {
      return false
    } else if (includeDev &&
               masterDependencies.ambientDevDependencies &&
               masterDependencies.ambientDevDependencies[dependency.name]) {
      return false
    }
  } else {
    if (masterDependencies.dependencies &&
        masterDependencies.dependencies[dependency.name]) {
      return false
    } else if (includeDev &&
               masterDependencies.devDependencies &&
               masterDependencies.devDependencies[dependency.name]) {
      return false
    }
  }
  return true
}

function partition<T>(array: T[], predicate: { (item: T): boolean }): [T[], T[]] {
  if (array == null) {
    return [[], []]
  }

  const truthy: T[] = []
  const falsey: T[] = []

  array.forEach(item => {
    const result = predicate(item)
    if (result) {
      truthy.push(item)
    } else {
      falsey.push(item)
    }
  })

  return [truthy, falsey]
}

interface PruneTypingsOptions {
    typingsFile: string
    typingsDirectory: string
    typingsName: string
    emitter: Emitter
}

function pruneTypings(options: PruneTypingsOptions): Promise<void> {
  const { typingsDirectory, typingsFile, typingsName, emitter } = options
  emitter.emit('prune', typingsName)

  // Trying to prune file
  return isFile(typingsFile)
    .then(exists => {
      if (exists) {
        return rimraf(typingsDirectory)
      }
    })
}
