import test = require('blue-tape')
import { join } from 'path'
import * as references from './references'

test('references', t => {
  t.test('parse references from string', t => {
    const file = `
/// <reference path="foobar.d.ts" />

///\t<reference\t path="example.d.ts"/>
`

    const actual = references.extractReferences(file, __dirname)

    const expected = [
      {
        start: 1,
        end: 38,
        path: join(__dirname, 'foobar.d.ts')
      },
      {
        start: 39,
        end: 77,
        path: join(__dirname, 'example.d.ts')
      }
    ]

    t.deepEqual(actual, expected)
    t.end()
  })

  t.test('compile a path to reference string', t => {
    const actual = references.toReference('foobar.d.ts', __dirname)
    const expected = '/// <reference path="foobar.d.ts" />'

    t.equal(actual, expected)
    t.end()
  })

  t.test('parse dependency information from a reference path', t => {
    let path = '/some/path/to/typings/main/definitions/dep/index.d.ts'
    let dependencyInfo = references.parseReferencePath(path)

    t.equal(dependencyInfo.target, references.DependencyTarget.Main)
    t.equal(dependencyInfo.type, references.DependencyType.External)
    t.equal(dependencyInfo.name, 'dep')

    path = '/some/other/path/to/typings/browser/ambient/otherDep/index.d.ts'
    dependencyInfo = references.parseReferencePath(path)

    t.equal(dependencyInfo.target, references.DependencyTarget.Browser)
    t.equal(dependencyInfo.type, references.DependencyType.Ambient)
    t.equal(dependencyInfo.name, 'otherDep')

    path = '/path/to/typings/notMain/notAmbient/random/index.d.ts'
    dependencyInfo = references.parseReferencePath(path)

    t.equal(dependencyInfo, null)
    t.end()
  })
})
