import rc = require('rc')
import extend = require('xtend')
import { PROJECT_NAME, REGISTRY_URL } from './config'
import { RcConfig } from '../interfaces'

export const DEFAULTS = {
  userAgent: `${PROJECT_NAME}/{typingsVersion} node/{nodeVersion} {platform} {arch}`,
  registryURL: REGISTRY_URL,
  defaultSource: 'npm',
  defaultAmbientSource: 'dt'
}

export default extend(DEFAULTS, rc(PROJECT_NAME)) as RcConfig
