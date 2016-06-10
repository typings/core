import test = require('blue-tape')
import { normalize } from 'path'
import { parseDependency, resolveDependency, expandRegistry } from './parse'
import { CONFIG_FILE } from './config'
import { Dependency } from '../interfaces'

test('parse', t => {
  t.test('parse dependency', t => {
    t.test('parse filename', t => {
      const actual = parseDependency('file:./foo/bar.d.ts')
      const expected: Dependency = {
        raw: 'file:./foo/bar.d.ts',
        location: normalize('foo/bar.d.ts'),
        meta: {
          name: 'bar',
          path: normalize('foo/bar.d.ts')
        },
        type: 'file'
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse filename relative', t => {
      const actual = parseDependency('file:foo/bar.d.ts')
      const expected: Dependency = {
        raw: 'file:foo/bar.d.ts',
        location: normalize('foo/bar.d.ts'),
        meta: {
          name: 'bar',
          path: normalize('foo/bar.d.ts')
        },
        type: 'file'
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse npm', t => {
      const actual = parseDependency('npm:foobar')
      const expected: Dependency = {
        raw: 'npm:foobar',
        type: 'npm',
        meta: {
          name: 'foobar',
          path: 'package.json'
        },
        location: normalize('foobar/package.json')
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse scoped npm packages', t => {
      const actual = parseDependency('npm:@foo/bar')
      const expected: Dependency = {
        raw: 'npm:@foo/bar',
        type: 'npm',
        meta: {
          name: '@foo/bar',
          path: 'package.json'
        },
        location: normalize('@foo/bar/package.json')
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse npm filename', t => {
      const actual = parseDependency('npm:typescript/bin/lib.es6.d.ts')
      const expected: Dependency = {
        raw: 'npm:typescript/bin/lib.es6.d.ts',
        type: 'npm',
        meta: {
          name: 'typescript',
          path: normalize('bin/lib.es6.d.ts')
        },
        location: normalize('typescript/bin/lib.es6.d.ts')
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse bower', t => {
      const actual = parseDependency('bower:foobar')
      const expected: Dependency = {
        raw: 'bower:foobar',
        type: 'bower',
        meta: {
          name: 'foobar',
          path: 'bower.json'
        },
        location: normalize('foobar/bower.json')
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse bower filename', t => {
      const actual = parseDependency('bower:foobar/' + CONFIG_FILE)
      const expected: Dependency = {
        raw: 'bower:foobar/' + CONFIG_FILE,
        type: 'bower',
        meta: {
          name: 'foobar',
          path: CONFIG_FILE
        },
        location: normalize('foobar/' + CONFIG_FILE)
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse github', t => {
      const actual = parseDependency('github:foo/bar')
      const expected: Dependency = {
        raw: 'github:foo/bar',
        type: 'github',
        meta: {
          name: undefined,
          org: 'foo',
          path: CONFIG_FILE,
          repo: 'bar',
          sha: 'master'
        },
        location: 'https://raw.githubusercontent.com/foo/bar/master/' + CONFIG_FILE
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse github with sha and append config file', t => {
      const actual = parseDependency('github:foo/bar#test')
      const expected: Dependency = {
        raw: 'github:foo/bar#test',
        type: 'github',
        meta: {
          name: undefined,
          org: 'foo',
          path: CONFIG_FILE,
          repo: 'bar',
          sha: 'test'
        },
        location: 'https://raw.githubusercontent.com/foo/bar/test/' + CONFIG_FILE
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse github paths to `.d.ts` files', t => {
      const actual = parseDependency('github:foo/bar/typings/file.d.ts')
      const expected: Dependency = {
        raw: 'github:foo/bar/typings/file.d.ts',
        type: 'github',
        meta: {
          name: 'file',
          org: 'foo',
          path: 'typings/file.d.ts',
          repo: 'bar',
          sha: 'master'
        },
        location: 'https://raw.githubusercontent.com/foo/bar/master/typings/file.d.ts'
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse github paths to config file', t => {
      const actual = parseDependency('github:foo/bar/src/' + CONFIG_FILE)
      const expected: Dependency = {
        raw: 'github:foo/bar/src/' + CONFIG_FILE,
        type: 'github',
        meta: {
          name: undefined,
          org: 'foo',
          path: `src/${CONFIG_FILE}`,
          repo: 'bar',
          sha: 'master'
        },
        location: 'https://raw.githubusercontent.com/foo/bar/master/src/' + CONFIG_FILE
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse bitbucket', t => {
      const actual = parseDependency('bitbucket:foo/bar')
      const expected: Dependency = {
        raw: 'bitbucket:foo/bar',
        type: 'bitbucket',
        meta: {
          name: undefined,
          org: 'foo',
          path: CONFIG_FILE,
          repo: 'bar',
          sha: 'master'
        },
        location: 'https://bitbucket.org/foo/bar/raw/master/' + CONFIG_FILE
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse bitbucket and append config file to path', t => {
      const actual = parseDependency('bitbucket:foo/bar/dir')
      const expected: Dependency = {
        raw: 'bitbucket:foo/bar/dir',
        type: 'bitbucket',
        meta: {
          name: undefined,
          org: 'foo',
          path: `dir/${CONFIG_FILE}`,
          repo: 'bar',
          sha: 'master'
        },
        location: 'https://bitbucket.org/foo/bar/raw/master/dir/' + CONFIG_FILE
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse bitbucket with sha', t => {
      const actual = parseDependency('bitbucket:foo/bar#abc')
      const expected: Dependency = {
        raw: 'bitbucket:foo/bar#abc',
        type: 'bitbucket',
        meta: {
          name: undefined,
          org: 'foo',
          path: CONFIG_FILE,
          repo: 'bar',
          sha: 'abc'
        },
        location: 'https://bitbucket.org/foo/bar/raw/abc/' + CONFIG_FILE
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse url', t => {
      const actual = parseDependency('http://example.com/foo/' + CONFIG_FILE)
      const expected: Dependency = {
        raw: 'http://example.com/foo/' + CONFIG_FILE,
        type: 'http',
        meta: {},
        location: 'http://example.com/foo/' + CONFIG_FILE
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse registry', t => {
      const actual = parseDependency('registry:dt/node')
      const expected: Dependency = {
        raw: 'registry:dt/node',
        type: 'registry',
        meta: { name: 'node', source: 'dt', tag: undefined as string, version: undefined as string },
        location: 'https://api.typings.org/entries/dt/node/versions/latest'
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse registry with scoped package', t => {
      const actual = parseDependency('registry:npm/@scoped/npm')
      const expected: Dependency = {
        raw: 'registry:npm/@scoped/npm',
        type: 'registry',
        meta: { name: '@scoped/npm', source: 'npm', tag: undefined as string, version: undefined as string },
        location: 'https://api.typings.org/entries/npm/%40scoped%2Fnpm/versions/latest'
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse registry with tag', t => {
      const actual = parseDependency('registry:npm/dep#3.0.0-2016')
      const expected: Dependency = {
        raw: 'registry:npm/dep#3.0.0-2016',
        type: 'registry',
        meta: { name: 'dep', source: 'npm', tag: '3.0.0-2016', version: undefined as string },
        location: 'https://api.typings.org/entries/npm/dep/tags/3.0.0-2016'
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('parse registry with version', t => {
      const actual = parseDependency('registry:npm/dep@^4.0')
      const expected: Dependency = {
        raw: 'registry:npm/dep@^4.0',
        type: 'registry',
        meta: { name: 'dep', source: 'npm', tag: undefined as string, version: '^4.0' },
        location: 'https://api.typings.org/entries/npm/dep/versions/%5E4.0/latest'
      }

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('expand registry with default source', t => {
      const actual = expandRegistry('domready')
      const expected = 'registry:npm/domready'

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('expand registry with provided source', t => {
      const actual = expandRegistry('env~atom')
      const expected = 'registry:env/atom'

      t.deepEqual(actual, expected)
      t.end()
    })

    t.test('unknown scheme', t => {
      t.throws(() => parseDependency('random:fake/dep'), /Unknown dependency: /)
      t.end()
    })
  })

  t.test('resolve dependency', t => {
    t.equal(resolveDependency('github:foo/bar/baz/x.d.ts', '../lib/test.d.ts'), 'github:foo/bar/lib/test.d.ts')
    t.equal(resolveDependency('http://example.com/foo/bar.d.ts', 'x.d.ts'), 'http://example.com/foo/x.d.ts')

    t.end()
  })
})
