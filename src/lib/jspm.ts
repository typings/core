import { join, dirname, resolve as resolvePath } from 'path'
import Promise = require('any-promise')
import pick = require('object.pick')
import zipObject = require('zip-object')
import extend = require('xtend')
import {
  // resolveAll,
  resolve,
  DependencyTree as JspmDependencyTree,
  DependencyBranch as JspmDependencyBranch
} from 'jspm-config'

import { readJson } from '../utils/fs'
import { CONFIG_FILE } from '../utils/config'
import { Dependency, DependencyTree, DependencyBranch } from '../interfaces'
import {
  DEFAULT_DEPENDENCY,
  Options,
  resolveError,
  mergeDependencies,
  maybeResolveTypeDependencyFrom
} from './dependencies'
import { findUp } from '../utils/find'

interface JspmOptions extends Options {
  raw: string
}

interface Metadata {
  name: any
  version: any
  main: any
  browser: any
  typings: any
  browserTypings: any
  // configFiles: {
  //   jspm: string
  //   node?: string
  // },
  // packagePath: string
  // paths: { [index: string]: string }
  // map: Map,
  // packages: {
  //   [index: string]: {
  //     map: Map
  //   }
  // }
  // dependencies: {
  //   [index: string]: {
  //     deps: Map
  //     peerDeps: Map
  //   }
  // }
}

/**
 * Resolve a dependency in Jspm.
 */
export function resolveDependency(dependency: Dependency, options: Options): Promise<DependencyTree> {
  const name = dependency.meta.name
  return findUp(options.cwd, 'package.json')
    .then((packageJsonPath: string) => {
      const cwd = dirname(packageJsonPath)
      return resolve(name, { cwd })
    })
    .then(
    tree => {
      const { raw } = dependency
      const jspmOptions = extend(options, { raw })
      return resolveDependencyInternal(name, tree, jspmOptions)
    },
    error => {
      return Promise.reject(resolveError(dependency.raw, error, options))
    })
}

function resolveDependencyInternal(
  name: string,
  dependencyTree: JspmDependencyTree,
  options: JspmOptions): Promise<DependencyTree> {
  const modulePath = dependencyTree.path
  const { parent, raw } = options
  options.emitter.emit('resolve', { name, modulePath, raw, parent })
  return readModuleMetaData(modulePath, options)
    .then(meta => {
      const tree = extend(
        DEFAULT_DEPENDENCY, {
          name: name,
          global: false,
          modulePath,
          raw,
          parent
        },
        meta)

      const dependencyOptions = extend(options, { parent: tree })
      options.emitter.emit('resolved', { name, modulePath, tree, raw, parent })
      const configPath = resolvePath(options.cwd, modulePath, CONFIG_FILE)
      return Promise.all([
        resolveDependencyMap(dependencyTree.map, dependencyOptions),
        maybeResolveTypeDependencyFrom(configPath, raw, options)
      ])
        .then(([dependencies, typedPackage]) => {
          tree.dependencies = dependencies
          return mergeDependencies(tree, typedPackage)
        })
    })
}

function readModuleMetaData(modulePath: string, options: Options): Promise<Metadata> {
  return readJson(join(options.cwd, modulePath, 'package.json'))
    .then(pjson => {
      return pick(pjson, [
        'name',
        'version',
        'main',
        'browser',
        'typings',
        'browserTypings'
      ])
    })
}

/**
 * Recursively resolve dependencies from a list and component path.
 */
function resolveDependencyMap(
  dependencies: JspmDependencyBranch = {},
  options: JspmOptions
): Promise<DependencyBranch> {
  const keys = Object.keys(dependencies)
  return Promise
    .all(keys.map(function (name) {
      const dependencyTree = dependencies[name]
      return resolveDependencyInternal(name, dependencyTree, options)
    }))
    .then(results => zipObject(keys, results))
}

// function resolveJspmDependencyInternal(name: string, raw: string, node: DependencyNode, options: Options) {
//   const modulePath = node.path
//   const { parent } = options
//   options.emitter.emit('resolve', { name, modulePath, raw, parent })
//   const tree = extend(DEFAULT_DEPENDENCY, {
//     name,
//     version: metadata.version,
//     main: metadata.main,
//     browser: metadata.browser,
//     typings: metadata.typings,
//     browserTypings: metadata.browserTypings,
//     global: false,
//     modulePath,
//     raw,
//     parent
//   })

//   const moduleDeps = metadata.dependencies[value]
//   const dependencyMap = extend(moduleDeps.deps)
//   const dependencyOptions = extend(options, { parent: tree })
//   options.emitter.emit('resolved', { name, modulePath, tree, raw, parent })

//   return Promise.all([
//     resolveJspmDependencyMap(dependencyMap, metadata, dependencyOptions),
//     maybeResolveTypeDependencyFrom(join(modulePath, CONFIG_FILE), raw, options)
//   ])
//     .then(([dependencies, typedPackage]) => {
//       tree.dependencies = dependencies
//       return mergeDependencies(tree, typedPackage)
//     })
//     .then(
//     null,
//     (error) => {
//       return Promise.reject(resolveError(raw, error, options))
//     }
//     )
// }

// export interface Map { [index: string]: string }

// /**
//  * Read jspm Metadata from the specified path to package.json.
//  * @param pjsonPath Path to package.json of the current project/module.
//  * @return Promise with Metadata. Promise will resolve to null if the project does not use jspm.
//  */
// export function readMetadata(pjsonPath: string): Promise<Metadata> {
//   return readJson(pjsonPath)
//     .then((pjson) => {
//       let picked = pick(pjson, [
//         'name',
//         'version',
//         'main',
//         'browser',
//         'typings',
//         'browserTypings',
//         'jspm',
//         'directories',
//         'configFile',
//         'configFiles'
//       ])

//       if (typeof picked.jspm === 'undefined') {
//         // It's not a jspm package
//         // Should it throws instead?
//         return null
//       } else if (typeof picked.jspm === 'object') {
//         picked = extend(picked, pick(picked.jspm, [
//           'name',
//           'main',
//           'directories',
//           'configFile',
//           'configFiles'
//         ]))
//       }

//       const basePath = dirname(pjsonPath)

//       const configFiles = picked.configFiles ?
//         {
//           jspm: picked.configFiles.jspm,
//           node: picked.configFiles['jspm:node']
//         } :
//         picked.configFile ?
//           {
//             jspm: picked.configFile,
//             node: undefined
//           } :
//           {
//             jspm: isFile(join(basePath, 'jspm.config.js')) ?
//               'jspm.config.js' : 'config.js',
//             node: undefined
//           }

//       const packagePath = picked.directories && picked.directories.packages || 'jspm_packages'

//       let jspm = join(basePath, configFiles.jspm)
//       let node = configFiles.node ? join(basePath, configFiles.node) : undefined
//       const jspmConfig = readJspmConfig(jspm, node)

//       return readJson(join(basePath, packagePath, '.dependencies.json'))
//         .then((dependencies) => {
//           let metadata: Metadata = {
//             name: picked.name,
//             version: picked.version,
//             main: picked.main,
//             browser: picked.browser,
//             typings: picked.typings,
//             browserTypings: picked.browserTypings,
//             configFiles,
//             packagePath,
//             packages: jspmConfig.packages,
//             paths: jspmConfig.paths,
//             map: jspmConfig.map,
//             dependencies
//           }
//           return metadata
//         })
//     })
// }

// Coming Soon
// /**
//  * Follow and resolve Jspm dependencies.
//  */
// export function resolveJspmDependencies(options: Options): Promise<DependencyTree> {
//   return findUp(options.cwd, 'package.json')
//     .then((packageJsonPath: string) => {
//       const cwd = dirname(packageJsonPath)
//       return resolveAll({ cwd })
//     })
//     .then(
//     dependencyTree => {
//       return resolveJspmDependencyInternal(undefined, undefined, metadata, options)
//     },
//     cause => {
//       return Promise.reject(new TypingsError(`Unable to resolve JSPM dependencies`, cause))
//     })
// }
