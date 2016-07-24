// import Promise = require('any-promise')
// import pick = require('object.pick')
// import { join, dirname } from 'path'
// import { readJson, isFile } from '../utils/fs'
// import extend = require('xtend')
// import {
//   resolveAll as jspmResolveAll,
//   resolve as jspmResolve,
//   DependencyTree as JspmDependencyTree,
//  } from 'jspm-config'

// export interface Map { [index: string]: string }

// export interface Metadata {
//   name: any
//   version: any
//   main: any
//   browser: any
//   typings: any
//   browserTypings: any
//   configFiles: {
//     jspm: string
//     node?: string
//   },
//   packagePath: string
//   paths: { [index: string]: string }
//   map: Map,
//   packages: {
//     [index: string]: {
//       map: Map
//     }
//   }
//   dependencies: {
//     [index: string]: {
//       deps: Map
//       peerDeps: Map
//     }
//   }
// }

// export function resolvePath(value: string, meta: Metadata) {
//   const parts = value.split(':', 2)
//   const basePath = meta.paths[parts[0] + ':']
//   return join(basePath, parts[1])
// }

// export function readJspmPackage(pjsonPath: string) {
//   return readJson(pjsonPath)
//     .then((pjson) => {
//       let picked = pick(pjson, [
//         'name',
//         'version',
//         'main',
//         'browser',
//         'typings',
//         'browserTypings',
//         'jspm'
//       ])

//       if (typeof picked.jspm === 'object') {
//         picked = extend(picked, pick(picked.jspm, [
//           'name',
//           'main'
//         ]))
//       }
//       return picked
//     })
// }

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
// /**
//  * Follow and resolve Jspm dependencies.
//  */
// export function resolveJspmDependencies (options: Options): Promise<DependencyTree> {
//   return findUp(options.cwd, 'package.json')
//     .then((packageJsonPath: string) => {
//       const cwd = dirname(packageJsonPath)
//       return jspmResolveAll({ cwd })
//     })
//     .then(
//       dependencyTree => {
//         return resolveJspmDependencyInternal(undefined, undefined, metadata, options)
//       },
//       cause => {
//         return Promise.reject(new TypingsError(`Unable to resolve JSPM dependencies`, cause))
//       })
// }

// /**
//  * Resolve a dependency in Jspm.
//  */
// function resolveJspmDependency (dependency: Dependency, options: Options) {
//   return findUp(options.cwd, 'package.json')
//     .then((packageJsonPath: string) => {
//       const cwd = dirname(packageJsonPath)
//       return jspmResolve(dependency.meta.name, { cwd })
//     })
//     .then(
//       dependencyTree => {
//         return resolveJspmDependencyInternal(dependency.meta.name, dependency.raw, metadata, options)
//       },
//       (error) => {
//         return Promise.reject(resolveError(dependency.raw, error, options))
//       })
// }

// function resolveJspmDependencyInternal(name: string, raw: string, metadata: JspmMetadata, options: Options) {
//     const value = metadata.map[name]
//     const modulePath = resolveJspmPath(value, metadata)
//     const { parent } = options
//     options.emitter.emit('resolve', { name, modulePath, raw, parent })
//     const tree = extend(DEFAULT_DEPENDENCY, {
//       name: metadata.name,
//       version: metadata.version,
//       main: metadata.main,
//       browser: metadata.browser,
//       typings: metadata.typings,
//       browserTypings: metadata.browserTypings,
//       global: false,
//       modulePath,
//       raw,
//       parent
//     })

//     const moduleDeps = metadata.dependencies[value]
//     const dependencyMap = extend(moduleDeps.deps)
//     const dependencyOptions = extend(options, { parent: tree })
//     options.emitter.emit('resolved', { name, modulePath, tree, raw, parent })

//     return Promise.all([
//       resolveJspmDependencyMap(dependencyMap, metadata, dependencyOptions),
//       maybeResolveTypeDependencyFrom(join(modulePath, CONFIG_FILE), raw, options)
//     ])
//       .then(([dependencies, typedPackage]) => {
//         tree.dependencies = dependencies
//         return mergeDependencies(tree, typedPackage)
//       })
//     .then(
//       null,
//       (error) => {
//         return Promise.reject(resolveError(raw, error, options))
//       }
//     )
// }

// /**
//  * Recursively resolve dependencies from a list and component path.
//  */
// function resolveJspmDependencyMap (
//   dependencies: Dependencies,
//   meta: JspmMetadata,
//   options: Options
// ): Promise<DependencyBranch> {
//   const keys = Object.keys(dependencies)
//   const { parent } = options

//   return Promise.all(keys.map(function (name) {
//     const value = dependencies[name]
//     const modulePath = resolveJspmPath(value, meta)

//     const tree = extend(DEFAULT_DEPENDENCY, {
//       name: meta.name,
//       version: meta.version,
//       main: meta.main,
//       browser: meta.browser,
//       typings: meta.typings,
//       browserTypings: meta.browserTypings,
//       global: false,
//       modulePath,
//       parent
//     })

//     const moduleDeps = meta.dependencies[value]
//     console.log(name, value, moduleDeps)
//     const dependencyMap = extend(moduleDeps.deps)
//     const dependencyOptions = extend(options, { parent: tree })
//     options.emitter.emit('resolved', { name, modulePath, tree, value, parent })
//     return Promise.all([
//       resolveJspmDependencyMap(dependencyMap, meta, dependencyOptions),
//       maybeResolveTypeDependencyFrom(join(modulePath, CONFIG_FILE), value, options)
//     ])
//       .then(([dependencies, typedPackage]) => {
//         tree.dependencies = dependencies
//         return mergeDependencies(tree, typedPackage)
//       })
//     .then(
//       null,
//       (error) => {
//         return Promise.reject(resolveError(value, error, options))
//       }
//     )
//   }))
//     .then(results => zipObject(keys, results))
// }
