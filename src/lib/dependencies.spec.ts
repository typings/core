import test = require('blue-tape')
import { join } from 'path'
import { EventEmitter } from 'events'

import { resolveAllDependencies } from './dependencies'
import { DependencyTree, DependencyBranch } from '../interfaces'

const RESOLVE_FIXTURE_DIR = join(__dirname, '__test__/fixtures/resolve')
const emitter = new EventEmitter()

test('dependencies', t => {
  t.test('resolve fixture', t => {
    t.test('resolve a dependency tree', t => {
      const expected: DependencyTree = {
        raw: undefined,
        global: false,
        postmessage: undefined,
        name: 'foobar',
        src: join(RESOLVE_FIXTURE_DIR, 'typings.json'),
        main: 'foo.d.ts',
        files: undefined,
        version: undefined,
        browser: undefined,
        typings: undefined,
        browserTypings: undefined,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        globalDependencies: {},
        globalDevDependencies: {}
      }

      const bowerDep: DependencyTree = {
        raw: 'bower:bower-dep',
        global: false,
        postmessage: undefined,
        src: join(RESOLVE_FIXTURE_DIR, 'bower_components/bower-dep/bower.json'),
        typings: 'bower-dep.d.ts',
        browserTypings: undefined,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        globalDependencies: {},
        globalDevDependencies: {},
        name: 'bower-dep',
        files: undefined,
        version: undefined,
        main: 'index.js',
        browser: undefined
      }

      const exampleDep: DependencyTree = {
        raw: 'bower:example',
        global: false,
        postmessage: undefined,
        src: join(RESOLVE_FIXTURE_DIR, 'bower_components/example/bower.json'),
        main: undefined,
        browser: undefined,
        files: undefined,
        version: undefined,
        typings: undefined,
        browserTypings: undefined,
        name: 'example',
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        globalDependencies: {},
        globalDevDependencies: {}
      }

      const typedDep: DependencyTree = {
        raw: 'file:typings/dep.d.ts',
        global: undefined,
        postmessage: undefined,
        src: join(RESOLVE_FIXTURE_DIR, 'typings/dep.d.ts'),
        typings: join(RESOLVE_FIXTURE_DIR, 'typings/dep.d.ts'),
        main: undefined,
        browser: undefined,
        files: undefined,
        version: undefined,
        browserTypings: undefined,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        globalDependencies: {},
        globalDevDependencies: {}
      }

      const npmDep: DependencyTree = {
        raw: 'npm:npm-dep',
        global: false,
        postmessage: undefined,
        src: join(RESOLVE_FIXTURE_DIR, 'node_modules/npm-dep/package.json'),
        main: './index.js',
        browser: undefined,
        files: undefined,
        version: undefined,
        typings: undefined,
        browserTypings: undefined,
        name: 'npm-dep',
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        globalDependencies: {},
        globalDevDependencies: {}
      }

      const typedDevDep: DependencyTree = {
        globalDependencies: {},
        globalDevDependencies: {},
        browser: undefined,
        browserTypings: undefined,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        main: undefined,
        name: 'dep',
        raw: 'bower:dep',
        global: false,
        postmessage: undefined,
        src: join(RESOLVE_FIXTURE_DIR, 'bower_components/dep/bower.json'),
        typings: undefined,
        files: undefined,
        version: undefined
      }

        ; (expected as any).dependencies['bower-dep'] = bowerDep
        ; (expected as any).dependencies.dep = typedDep
        ; (expected as any).dependencies['npm-dep'] = npmDep
        ; (expected as any).devDependencies['dev-dep'] = typedDevDep

        ; (bowerDep as any).dependencies.example = exampleDep

      return resolveAllDependencies({
        cwd: RESOLVE_FIXTURE_DIR,
        dev: true,
        emitter
      })
        .then((result) => {
          function removeParentReferenceFromDependencies(dependencies: DependencyBranch) {
            Object.keys(dependencies).forEach(function (key) {
              removeParentReference(dependencies[key])
            })
          }

          function removeParentReference(tree: DependencyTree) {
            delete tree.parent

            removeParentReferenceFromDependencies(tree.dependencies)
            removeParentReferenceFromDependencies(tree.devDependencies)
            removeParentReferenceFromDependencies(tree.peerDependencies)
            removeParentReferenceFromDependencies(tree.globalDependencies)
            removeParentReferenceFromDependencies(tree.globalDevDependencies)

            return tree
          }

          t.equal(result.parent, undefined)
          t.ok((result.dependencies as any).dep.parent != null)
          t.ok((result.dependencies as any)['npm-dep'].parent != null)

          removeParentReference(result)

          console.log(result)
          t.deepEqual(result, expected)
        })
    })
  })
})
// { src: '/Users/hwong/github/typings/core/src/lib/__test__/fixtures/resolve/typings.json',
//           raw: undefined,
//           main: 'foo.d.ts',
//           browser: undefined,
//           typings: undefined,
//           browserTypings: undefined,
//           version: undefined,
//           files: undefined,
//           global: false,
//           postmessage: undefined,
//           dependencies:
//            { 'bower-dep':
//               { src: '/Users/hwong/github/typings/core/src/lib/__test__/fixtures/resolve/bower_components/bower-dep/bower.json',
//                 raw: 'bower:bower-dep',
//                 main: 'index.js',
//                 browser: undefined,
//                 typings: 'bower-dep.d.ts',
//                 browserTypings: undefined,
//                 version: undefined,
//                 files: undefined,
//                 global: false,
//                 postmessage: undefined,
//                 dependencies: [Object],
//                 devDependencies: {},
//                 peerDependencies: {},
//                 globalDependencies: {},
//                 globalDevDependencies: {},
//                 name: 'bower-dep' },
//              dep:
//               { src: '/Users/hwong/github/typings/core/src/lib/__test__/fixtures/resolve/typings/dep.d.ts',
//                 raw: 'file:typings/dep.d.ts',
//                 main: undefined,
//                 browser: undefined,
//                 typings: '/Users/hwong/github/typings/core/src/lib/__test__/fixtures/resolve/typings/dep.d.ts',
//                 browserTypings: undefined,
//                 version: undefined,
//                 files: undefined,
//                 global: undefined,
//                 postmessage: undefined,
//                 dependencies: {},
//                 devDependencies: {},
//                 peerDependencies: {},
//                 globalDependencies: {},
//                 globalDevDependencies: {} },
//              'npm-dep':
//               { src: '/Users/hwong/github/typings/core/src/lib/__test__/fixtures/resolve/node_modules/npm-dep/package.json',
//                 raw: 'npm:npm-dep',
//                 main: './index.js',
//                 browser: undefined,
//                 typings: undefined,
//                 browserTypings: undefined,
//                 version: undefined,
//                 files: undefined,
//                 global: false,
//                 postmessage: undefined,
//                 dependencies: {},
//                 devDependencies: {},
//                 peerDependencies: {},
//                 globalDependencies: {},
//                 globalDevDependencies: {},
//                 name: 'npm-dep' } },
//           devDependencies:
//            { 'dev-dep':
//               { src: '/Users/hwong/github/typings/core/src/lib/__test__/fixtures/resolve/bower_components/dep/bower.json',
//                 raw: 'bower:dep',
//                 main: undefined,
//                 browser: undefined,
//                 typings: undefined,
//                 browserTypings: undefined,
//                 version: undefined,
//                 files: undefined,
//                 global: false,
//                 postmessage: undefined,
//                 dependencies: {},
//                 devDependencies: {},
//                 peerDependencies: {},
//                 globalDependencies: {},
//                 globalDevDependencies: {},
//                 name: 'dep' } },
//           peerDependencies: {},
//           globalDependencies: {},
//           globalDevDependencies: {},
//           name: 'foobar' }
