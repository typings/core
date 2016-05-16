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

      ;(expected as any).dependencies['bower-dep'] = bowerDep
      ;(expected as any).dependencies.dep = typedDep
      ;(expected as any).dependencies['npm-dep'] = npmDep
      ;(expected as any).devDependencies['dev-dep'] = typedDevDep

      ;(bowerDep as any).dependencies.example = exampleDep

      return resolveAllDependencies({
        cwd: RESOLVE_FIXTURE_DIR,
        dev: true,
        emitter
      })
        .then((result) => {
          function removeParentReferenceFromDependencies (dependencies: DependencyBranch) {
            Object.keys(dependencies).forEach(function (key) {
              removeParentReference(dependencies[key])
            })
          }

          function removeParentReference (tree: DependencyTree) {
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

          t.deepEqual(result, expected)
        })
    })
  })
})
