import { join } from 'path'
import { fixture } from '../utils/fixture'
import { readMetadata } from './jspm'

const FIXTURES_DIR = join(__dirname, '__test__/fixtures')
const ftest = fixture(FIXTURES_DIR)

ftest('jspm readMetadata', 'jspm-0.17-custom', (t, fixturePath) => {
  return readMetadata(join(fixturePath, 'package.json'))
    .then((metadata) => {
      t.deepEqual(metadata, {
        name: undefined,
        version: undefined,
        main: undefined,
        browser: undefined,
        typings: undefined,
        browserTypings: undefined,
        configFiles: {
          jspm: 'x/jspm.config.js',
          node: undefined
        },
        packagePath: 'cust_packages',
        paths: {
          'npm:': 'cust_packages/npm/'
        },
        map: {
          'domready': 'npm:domready@1.0.8'
        },
        dependencies: {
          'npm:domready@1.0.8': {
            'deps': {},
            'peerDeps': {}
          }
        }
      })
    })
})

ftest('jspm readMetadata', 'jspm-0.17', (t, fixturePath) => {
  return readMetadata(join(fixturePath, 'package.json'))
    .then((metadata) => {
      t.deepEqual(metadata, {
        name: undefined,
        version: undefined,
        main: undefined,
        browser: undefined,
        typings: undefined,
        browserTypings: undefined,
        configFiles: {
          jspm: 'jspm.config.js',
          node: undefined
        },
        packagePath: 'jspm_packages',
        paths: {
          'npm:': 'jspm_packages/npm/',
          'github:': 'jspm_packages/github/'
        },
        map: {
          'buffer': 'github:jspm/nodelibs-buffer@0.2.0-alpha',
          'domready': 'npm:domready@1.0.8',
          'lodash': 'npm:lodash@4.13.1',
          'process': 'github:jspm/nodelibs-process@0.2.0-alpha'
        },
        dependencies: {
          'npm:domready@1.0.8': {
            'deps': {},
            'peerDeps': {}
          },
          'npm:lodash@4.13.1': {
            'deps': {},
            'peerDeps': {
              'buffer': 'github:jspm/nodelibs-buffer@^0.2.0-alpha'
            }
          },
          'github:jspm/nodelibs-buffer@0.2.0-alpha': {
            'deps': {
              'buffer-browserify': 'npm:buffer@^4.0.0'
            },
            'peerDeps': {}
          },
          'npm:buffer@4.6.0': {
            'deps': {
              'base64-js': 'npm:base64-js@^1.0.2',
              'ieee754': 'npm:ieee754@^1.1.4',
              'isarray': 'npm:isarray@^1.0.0'
            },
            'peerDeps': {
              'buffer': 'github:jspm/nodelibs-buffer@^0.2.0-alpha',
              'process': 'github:jspm/nodelibs-process@^0.2.0-alpha'
            }
          },
          'npm:ieee754@1.1.6': {
            'deps': {},
            'peerDeps': {
              'buffer': 'github:jspm/nodelibs-buffer@^0.2.0-alpha'
            }
          },
          'npm:isarray@1.0.0': {
            'deps': {},
            'peerDeps': {}
          },
          'npm:base64-js@1.1.2': {
            'deps': {},
            'peerDeps': {}
          },
          'github:jspm/nodelibs-process@0.2.0-alpha': {
            'deps': {},
            'peerDeps': {}
          }
        }
      })
    })
})
