import rc = require('rc')
import extend = require('xtend')
import { PROJECT_NAME, REGISTRY_URL } from './config'

export interface RcConfig {
  proxy?: string
  httpProxy?: string
  httpsProxy?: string
  noProxy?: string
  rejectUnauthorized?: boolean
  ca?: string | string[]
  key?: string
  cert?: string
  userAgent?: string
  githubUsername?: string
  githubToken?: string
  registryURL?: string
  defaultSource?: string
  defaultAmbientSource?: string
}

export const DEFAULTS = {
  userAgent: `${PROJECT_NAME}/{typingsVersion} node/{nodeVersion} {platform} {arch}`,
  registryURL: REGISTRY_URL,
  defaultSource: 'npm',
  defaultAmbientSource: 'dt'
}

export default extend(DEFAULTS, rc(PROJECT_NAME)) as RcConfig
