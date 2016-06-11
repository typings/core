import Promise = require('any-promise')
import pick = require('object.pick')
import { join, dirname } from 'path'
import { readJson } from './fs'
import extend = require('xtend')

export interface Config {
  packages: string,
  configFile: string,
  paths: { [index: string]: string },
  map: { [index: string]: string }
}

function readJspmConfig(jspmConfigPath: string): {
  paths: { [index: string]: string },
  map: { [index: string]: string }
} {
  let g: any = global
  let sys = g.System
  let config: Config = {} as Config
  g.System = {
    config(conf: Object) {
      config = extend(config, conf)
    }
  }
  require(jspmConfigPath)
  g.System = sys
  return config
}

export function readConfig(pjsonPath: string): Promise<Config> {
  return readJson(pjsonPath)
    .then((pjson) => {
      let picked = pick(pjson, [
        'jspm',
        'directories',
        'configFile'
      ])
      let config: Config = null
      if (typeof picked.jspm === 'undefined') {
        return config
      } else if (typeof picked.jspm === 'object') {
        picked = pick(picked.jspm, [
          'directories',
          'configFile'
        ])
      }

      // TODO: 0.16 vs 0.17 detection
      const configFile = picked.configFile || 'jspm.config.js'
      const packages = picked.directories && picked.directories.packages || 'jspm_packages'
      const basePath = dirname(pjsonPath)
      const configPath = join(basePath, configFile)
      const jspmConfig = readJspmConfig(configPath)
      config = {
        configFile,
        packages,
        paths: jspmConfig.paths,
        map: jspmConfig.map
      }

      return config
    })
}
