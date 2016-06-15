import Promise = require('any-promise')
import pick = require('object.pick')
import { join, dirname } from 'path'
import { readJson, isFile } from '../utils/fs'
import extend = require('xtend')

export interface Metadata {
  name: any
  version: any
  main: any
  browser: any
  typings: any
  browserTypings: any
  configFiles: {
    jspm: string
    node?: string
  },
  packagePath: string
  paths: { [index: string]: string }
  map: { [index: string]: string }
  dependencies: {
    [index: string]: {
      deps: { [index: string]: string }
      peerDeps: { [index: string]: string }
    }
  }
}

function readJspmConfig(jspm: string, node?: string): any {
  let g: any = global
  let sys = g.System
  let sysjs = g.SystemJS
  let config = {}
  g.System = {
    config(conf: Object) {
      config = extend(config, conf)
    }
  }
  g.SystemJS = g.System
  require(jspm)
  delete require.cache[require.resolve(jspm)]
  if (node) {
    require(node)
    delete require.cache[require.resolve(node)]
  }

  g.System = sys
  g.SystemJS = sysjs
  return config
}

export function resolvePath(name: string, meta: Metadata) {
  const moduleReference = meta.map[name]
  const parts = moduleReference.split(':', 2)
  const basePath = meta.paths[parts[0] + ':']
  return join(basePath, parts[1])
}


/**
 * Read jspm Metadata from the specified path to package.json.
 * @param pjsonPath Path to package.json of the current project/module.
 * @return Promise with Metadata. Promise will resolve to null if the project does not use jspm.
 */
export function readMetadata(pjsonPath: string): Promise<Metadata> {
  return readJson(pjsonPath)
    .then((pjson) => {
      let picked = pick(pjson, [
        'name',
        'version',
        'main',
        'browser',
        'typings',
        'browserTypings',
        'jspm',
        'directories',
        'configFile',
        'configFiles'
      ])

      if (typeof picked.jspm === 'undefined') {
        // It's not a jspm package
        // Should it throws instead?
        return null
      } else if (typeof picked.jspm === 'object') {
        picked = pick(picked.jspm, [
          'name',
          'main',
          'directories',
          'configFile',
          'configFiles'
        ])
      }

      const basePath = dirname(pjsonPath)

      const configFiles = picked.configFiles ?
        {
          jspm: picked.configFiles.jspm,
          node: picked.configFiles['jspm:node']
        } :
        picked.configFile ?
          {
            jspm: picked.configFile,
            node: undefined
          } :
          {
            jspm: isFile(join(basePath, 'jspm.config.js')) ?
              'jspm.config.js' : 'config.js',
            node: undefined
          }

      const packagePath = picked.directories && picked.directories.packages || 'jspm_packages'

      let jspm = join(basePath, configFiles.jspm)
      let node = configFiles.node ? join(basePath, configFiles.node) : undefined
      const jspmConfig = readJspmConfig(jspm, node)

      return readJson(join(basePath, packagePath, '.dependencies.json'))
        .then((dependencies) => {
          let metadata: Metadata = {
            name: picked.name,
            version: picked.version,
            main: picked.main,
            browser: picked.browser,
            typings: picked.typings,
            browserTypings: picked.browserTypings,
            configFiles,
            packagePath,
            paths: jspmConfig.paths,
            map: jspmConfig.map,
            dependencies
          }
          return metadata
        })
    })
}
