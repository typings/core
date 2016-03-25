import { join } from 'path'
import Promise = require('any-promise')
import { EventEmitter } from 'events'
import { Emitter } from './interfaces'
import { resolveTypeDependencies, Options as DependencyOptions } from './lib/dependencies'
import { findProject } from './utils/find'
import { readFile, readConfig, writeFile, isDirectory, readSubDirs, rimraf } from './utils/fs'
import {
  CONFIG_FILE,
  TYPINGS_DIR,
  DTS_BROWSER_FILE,
  DTS_MAIN_FILE,
  MAIN_TYPINGS_DIR,
  BROWSER_TYPINGS_DIR,
  DEFINITIONS_DIR,
  AMBIENT_DEFINITIONS_DIR
} from './utils/config'

const REFERENCE_REGEXP = /^\/\/\/[ \t]*<reference[ \t]+path[ \t]*=("|')(.*?)\1.*?\/>[ \t]*\r?\n?/

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
      const typingsPath = join(project, TYPINGS_DIR)
      // Read typings from typings.json as master list
      return readMasterDependencies(project, !production)
        .then((masterDependencies: TypeDependencies) => {
          return Promise.all([
            // Prune browser.d.ts
            pruneExtraneousReferences({
              project,
              masterDependencies,
              dtsPath: join(typingsPath, DTS_BROWSER_FILE),
              emitter
            }),
            // Prune main.d.ts
            pruneExtraneousReferences({
              project,
              masterDependencies,
              dtsPath: join(typingsPath, DTS_MAIN_FILE),
              emitter
            }),
            // Prune typings/browser folder
            pruneExtraneousTypings({
              masterDependencies,
              typingsPath: join(typingsPath, BROWSER_TYPINGS_DIR),
              emitter
            }),
            // Prune typings/main folder
            pruneExtraneousTypings({
              masterDependencies,
              typingsPath: join(typingsPath, MAIN_TYPINGS_DIR),
              emitter
            }),
          ]).then(() => { }) // convert to Promise<void>
        })
    })
}

interface TypeDependencies {
  ambientDependencies: string[]
  externalDependencies: string[]
}

function readMasterDependencies(projectDirectory: string, includeDev: boolean): Promise<TypeDependencies> {
  return readConfig(join(projectDirectory, CONFIG_FILE))
    .then((config) => {
      const ambientDependencies = config.ambientDependencies != null
        ? Object.keys(config.ambientDependencies)
        : []

      const externalDependencies = config.dependencies != null
        ? Object.keys(config.dependencies)
        : []

      const dependencies: TypeDependencies = {
        ambientDependencies,
        externalDependencies
      }

      if (includeDev) {
        const ambientDevDependencies = config.ambientDevDependencies != null
          ? Object.keys(config.ambientDevDependencies)
          : []

        const externalDevDependencies = config.devDependencies != null
          ? Object.keys(config.devDependencies)
          : []

        dependencies.ambientDependencies = dependencies.ambientDependencies.concat(ambientDevDependencies)
        dependencies.externalDependencies = dependencies.externalDependencies.concat(externalDevDependencies)
      }

      return dependencies
    })
}

interface PruneReferencesOptions {
  masterDependencies: TypeDependencies
  project: string
  dtsPath: string
  emitter: Emitter
}

function pruneExtraneousReferences(options: PruneReferencesOptions) {
  const { masterDependencies, dtsPath, emitter } = options

  return readFile(dtsPath, 'utf8')
    .then((config: string) => {
      const lines = config.split('\n')
      // Split into extraneous and non-extraneous
      const partitionedLines = partition(lines, (line: string) => isExtraneousReference(masterDependencies, line))
      const [extraneousTypings, usedTypings] = partitionedLines

      // Write out references that are being pruned
      extraneousTypings.forEach((line: string) => emitter.emit('pruneReference', dtsPath, line, getReferenceType(line)))

      // Join remaining lines and write back to config
      const prunedConfig = usedTypings.join('\n')
      return writeFile(dtsPath, prunedConfig)
    })
}

function isExtraneousReference(masterDependencies: TypeDependencies, reference: string): boolean {
  const pathParts = getReferencePathParts(reference)
  if (pathParts) {
    const [ , ambientOrExternal, actualDependency] = pathParts

    const matchingMasterDeps = (ambientOrExternal == AMBIENT_DEFINITIONS_DIR)
      ? masterDependencies.ambientDependencies
      : masterDependencies.externalDependencies

    return !includes(matchingMasterDeps, actualDependency)
  }

  return false
}

function includes<T>(array: T[], item: T): boolean {
  return array.indexOf(item) >= 0
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

function getReferenceType(reference: string): string {
  const pathParts = getReferencePathParts(reference)
  return pathParts != null ? pathParts[2] : null
}

function getReferencePathParts(reference: string): string[] {
  const referenceMatchResult = REFERENCE_REGEXP.exec(reference)
  if (referenceMatchResult) {
    const path = referenceMatchResult[2]
    return path.split('/')
  } else {
    return null
  }
}

interface PruneTypingsOptions {
  masterDependencies: TypeDependencies
  typingsPath: string
  emitter: Emitter
}

function pruneExtraneousTypings(options: PruneTypingsOptions) {
  const { masterDependencies, typingsPath, emitter } = options

  const ambientPath = join(typingsPath, AMBIENT_DEFINITIONS_DIR)
  const externalPath = join(typingsPath, DEFINITIONS_DIR)

  return Promise.all([
    isDirectory(ambientPath),
    isDirectory(externalPath)
  ])
    .then(([hasAmbientTypings, hasExternalTypings]) => {
      if (hasAmbientTypings) {
        pruneExtraneousTypingsFolders({
          masterDependencies: masterDependencies.ambientDependencies,
          typingsPath: ambientPath,
          emitter
        })
      }

      if (hasExternalTypings) {
        pruneExtraneousTypingsFolders({
          masterDependencies: masterDependencies.externalDependencies,
          typingsPath: externalPath,
          emitter
        })
      }
    })
}

interface PruneTypingsFoldersOptions {
  masterDependencies: string[]
  typingsPath: string
  emitter: Emitter
}

function pruneExtraneousTypingsFolders(options: PruneTypingsFoldersOptions) {
  const { masterDependencies, typingsPath, emitter } = options

  return readSubDirs(options.typingsPath)
    .then(directories => {
      const extraneousDirs = directories.filter(dir => isExtraneousTyping(masterDependencies, dir))

      return Promise.all(
        extraneousDirs.map(dir => {
            const dirPath = join(options.typingsPath, dir)
            emitter.emit('pruneTypings', dirPath, dir)
            return rimraf(dirPath);
        })
      )
    })
}

function isExtraneousTyping(masterDependencies: string[], typing: string): boolean {
  return !includes(masterDependencies, typing)
}
