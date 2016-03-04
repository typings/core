import test = require('blue-tape')
import Promise = require('any-promise')
import { EOL } from 'os'
import { join } from 'path'
import { bundle } from './bundle'
import { VERSION } from './typings'
import { PROJECT_NAME } from './utils/config'
import { rimraf } from './utils/fs'

test('bundle', t => {
  t.test('bundle everything', t => {
    const FIXTURE_DIR = join(__dirname, '__test__/bundle')

    return rimraf(join(FIXTURE_DIR, 'out'))
      .then(() => {
        return bundle({
          cwd: FIXTURE_DIR,
          name: 'example',
          out: join(FIXTURE_DIR, 'out'),
          ambient: false
        })
      })
      .then(function (data) {
        t.equal(data.main, [
          `// Compiled using ${PROJECT_NAME}@${VERSION}`,
          `// Source: custom_typings/test.d.ts`,
          `declare module \'example~test\' {`,
          `export function test (): string;`,
          `}`,
          ``,
          `// Compiled using ${PROJECT_NAME}@${VERSION}`,
          `// Source: index.d.ts`,
          `declare module \'example/index\' {`,
          `import { test } from \'example~test\'`,
          `}`,
          `declare module \'example\' {}`
        ].join(EOL))
      })
  })
})
