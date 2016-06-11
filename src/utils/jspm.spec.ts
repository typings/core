import test = require('blue-tape')
import { join } from 'path'
import { readConfig } from './jspm'

const FIXTURES_DIR = join(__dirname, '__test__/fixtures')

test.only('parse', t => {
  t.test('fixtures', t => {
    t.test('jspm readConfig 0.17', t => {
      const FIXTURE_DIR = join(FIXTURES_DIR, 'jspm-0.17')
      return readConfig(join(FIXTURE_DIR, 'package.json'))
        .then((config) => {
          t.deepEqual(config, {
            packages: 'jspm_packages',
            configFile: 'jspm.config.js',
            paths: {
              'github:*': 'jspm_packages/github/*'
            },
            map: {
              'leaf': 'npm:leaf@1.2.3'
            }
          })
        })
    })
    t.test('jspm readConfig 0.17 custom config', t => {
      const FIXTURE_DIR = join(FIXTURES_DIR, 'jspm-0.17-custom-config')
      return readConfig(join(FIXTURE_DIR, 'package.json'))
        .then((config) => {
          t.deepEqual(config, {
            packages: 'cust_packages',
            configFile: 'abc.config.js',
            paths: {
              'github:*': 'cust_packages/github/*',
              'xyz:*': 'cust_packages/xyz/*'
            },
            map: {
              'leaf': 'xyz:org/leaf@1.2.3'
            }
          })
        })
    })
  })
})
