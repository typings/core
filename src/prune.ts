import { join, sep as pathSeparator } from 'path'
import Promise = require('any-promise')
import { EventEmitter } from 'events'
import { Emitter } from './interfaces'
import { findProject } from './utils/find'
import { readConfig, isFile, transformDtsFile, rimraf } from './utils/fs'
import { CONFIG_FILE, TYPINGS_DIR, DTS_BROWSER_FILE, DTS_MAIN_FILE } from './utils/config'
import { relativeTo, isDefinition } from './utils/path'

const AMBIENT_TYPE_DIR = 'ambient'

export interface PruneOptions {
  cwd: string
  production?: boolean
  emitter?: Emitter
}

export function prune(options: PruneOptions): Promise<void> {
  const { cwd, production } = options
  const emitter = options.emitter || new EventEmitter()

  return findProject(cwd)
    .then((project: string) => {
      return readMasterDependencies(project)
        .then((masterDependencies: TypeDependencies) => {
          const typingsPath = join(project, TYPINGS_DIR)

          return Promise.all([
            // Prune browser.d.ts
            pruneExtraneous({
              masterDependencies,
              typingsPath,
              includeDev: !production,
              dtsPath: join(typingsPath, DTS_BROWSER_FILE),
              emitter
            }),
            // Prune main.d.ts
            pruneExtraneous({
              masterDependencies,
              typingsPath,
              includeDev: !production,
              dtsPath: join(typingsPath, DTS_MAIN_FILE),
              emitter
            })
          ]).then(() => undefined)
        })
    })
}

interface TypeDependencies {
  ambientDependencies?: { [type: string]: string }
  ambientDevDependencies?: { [type: string]: string }
  dependencies?: { [type: string]: string }
  devDependencies?: { [type: string]: string }
}

function readMasterDependencies(projectDirectory: string): Promise<TypeDependencies> {
  return readConfig(join(projectDirectory, CONFIG_FILE))
}

interface PruneExtraneousOptions {
  masterDependencies: TypeDependencies
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

  const [ /* main|browser */ , type, ...names] = parts
  const relativeDirPath = parts.join(pathSeparator)

  return {
    path,
    directory: join(typingsDirectory, relativeDirPath),
    name: names.join(pathSeparator),
    isAmbient: type === AMBIENT_TYPE_DIR
  }
}

function isExtraneous(masterDependencies: TypeDependencies, dependency: DependencyInfo, includeDev: boolean): boolean {
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
