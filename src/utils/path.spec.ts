import test = require('blue-tape')
import { pathFromDefinition } from './path'

test('parse', t => {
  t.test('path from definition', t => {
    t.test('path', t => {
      t.equal(pathFromDefinition('foo/bar.d.ts'), 'foo/bar')
      t.end()
    })

    t.test('url', t => {
      t.equal(pathFromDefinition('http://example.com/test.d.ts'), '/test')
      t.end()
    })
  })
})
