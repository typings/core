import test = require('blue-tape')
import { join } from 'path'
import { resolveAllDependencies } from './dependencies'
import { DependencyTree, DependencyBranch } from '../interfaces/main'

const RESOLVE_FIXTURE_DIR = join(__dirname, '__test__/fixtures/resolve')

test('dependencies', t => {
  t.test('resolve fixture', t => {
    t.test('resolve a dependency tree', t => {
      const expected: DependencyTree = {
        raw: undefined,
        name: 'foobar',
        src: join(RESOLVE_FIXTURE_DIR, 'typings.json'),
        main: 'foo.d.ts',
        version: undefined,
        browser: undefined,
        typings: undefined,
        browserTypings: undefined,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        ambientDependencies: {},
        ambientDevDependencies: {}
      }

      const bowerDep: DependencyTree = {
        raw: 'bower:bower-dep',
        src: join(RESOLVE_FIXTURE_DIR, 'bower_components/bower-dep/bower.json'),
        typings: 'bower-dep.d.ts',
        browserTypings: undefined,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        ambientDependencies: {},
        ambientDevDependencies: {},
        name: 'bower-dep',
        version: undefined,
        main: 'index.js',
        browser: undefined
      }

      const exampleDep: DependencyTree = {
        raw: 'bower:example',
        src: join(RESOLVE_FIXTURE_DIR, 'bower_components/example/bower.json'),
        main: undefined,
        browser: undefined,
        version: undefined,
        typings: undefined,
        browserTypings: undefined,
        name: 'example',
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        ambientDependencies: {},
        ambientDevDependencies: {}
      }

      const typedDep: DependencyTree = {
        raw: 'file:typings/dep.d.ts',
        src: join(RESOLVE_FIXTURE_DIR, 'typings/dep.d.ts'),
        typings: join(RESOLVE_FIXTURE_DIR, 'typings/dep.d.ts'),
        main: undefined,
        browser: undefined,
        version: undefined,
        browserTypings: undefined,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        ambientDependencies: {},
        ambientDevDependencies: {}
      }

      const npmDep: DependencyTree = {
        raw: 'npm:npm-dep',
        src: join(RESOLVE_FIXTURE_DIR, 'node_modules/npm-dep/package.json'),
        main: './index.js',
        browser: undefined,
        version: undefined,
        typings: undefined,
        browserTypings: undefined,
        name: 'npm-dep',
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        ambientDependencies: {},
        ambientDevDependencies: {}
      }

      const typedDevDep: DependencyTree = {
        ambientDependencies: {},
        ambientDevDependencies: {},
        browser: undefined,
        browserTypings: undefined,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        main: undefined,
        name: 'dep',
        raw: 'bower:dep',
        src: join(RESOLVE_FIXTURE_DIR, 'bower_components/dep/bower.json'),
        typings: undefined,
        version: undefined
      }

      ;(expected as any).dependencies['bower-dep'] = bowerDep
      ;(expected as any).dependencies.dep = typedDep
      ;(expected as any).dependencies['npm-dep'] = npmDep
      ;(expected as any).devDependencies['dev-dep'] = typedDevDep

      ;(bowerDep as any).dependencies.example = exampleDep

      return resolveAllDependencies({
        cwd: RESOLVE_FIXTURE_DIR,
        dev: true
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
            removeParentReferenceFromDependencies(tree.ambientDependencies)
            removeParentReferenceFromDependencies(tree.ambientDevDependencies)

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
