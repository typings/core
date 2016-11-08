import test = require('blue-tape')
import { join } from 'path'
import { EventEmitter } from 'events'
import { resolveAllDependencies, resolveDependency } from './dependencies'
import { DependencyTree, DependencyBranch } from '../interfaces'

const FIXTURE_DIR = join(__dirname, '__test__/fixtures')
const emitter = new EventEmitter()

test('dependencies', t => {
  const RESOLVE_FIXTURE_DIR = join(__dirname, '__test__/fixtures/resolve')

  t.test('resolve fixture', t => {
    t.test('resolve a dependency tree', t => {
      const expected: DependencyTree = {
        raw: undefined,
        global: undefined,
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
        global: undefined,
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
        global: undefined,
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
        global: undefined,
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
        global: undefined,
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
          t.equal(result.parent, undefined)
          t.ok((result.dependencies as any).dep.parent != null)
          t.ok((result.dependencies as any)['npm-dep'].parent != null)

          removeParentReference(result)

          t.deepEqual(result, expected)
        })
    })
  })

  t.test('jspm module without package.json', t => {
    const cwd = join(FIXTURE_DIR, 'jspm-typings-registry')

    const jspmDep = {
      raw: 'jspm:make-error',
      type: 'jspm',
      meta: {
        name: 'make-error'
      }
    }

   const makeErrorDep: DependencyTree = {
      src: join(cwd, 'jspm_packages/npm/make-error@1.2.0/package.json'),
      raw: 'jspm:make-error',
      main: undefined,
      browser: undefined,
      typings: undefined,
      browserTypings: undefined,
      version: undefined,
      files: undefined,
      global: undefined,
      postmessage: undefined,
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      globalDependencies: {},
      globalDevDependencies: {},
      parent: undefined,
      name: undefined
    }
    return resolveDependency(jspmDep, { cwd, emitter })
      .then(actual => {
        t.deepEqual(actual, makeErrorDep)
      })
  })

  t.test('jspm resolve dependency', t => {
    const cwd = join(FIXTURE_DIR, 'jspm-typings-github')

    const jspmDep = {
      raw: 'jspm:unthenify',
      type: 'jspm',
      meta: {
        name: 'unthenify'
      }
    }

    const utilArityDep: DependencyTree = {
      src: join(cwd, 'jspm_packages/npm/util-arity@1.0.2/package.json'),
      raw: 'jspm:util-arity',
      main: 'arity.js',
      browser: undefined,
      typings: 'arity.d.ts',
      browserTypings: undefined,
      version: '1.0.2',
      files: undefined,
      global: undefined,
      postmessage: undefined,
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      globalDependencies: {},
      globalDevDependencies: {},
      name: 'util-arity'
    }

    const utilArityParent: DependencyTree = {
      src: join(cwd, 'jspm_packages/npm/unthenify@1.0.2/package.json'),
      raw: 'jspm:unthenify',
      main: 'dist/index.js',
      browser: undefined,
      typings: undefined,
      browserTypings: undefined,
      version: '1.0.2',
      files: undefined,
      global: undefined,
      postmessage: undefined,
      dependencies: {
        'util-arity': utilArityDep
      },
      devDependencies: {},
      peerDependencies: {},
      globalDependencies: {},
      globalDevDependencies: {},
      name: 'unthenify'
    }

    const es6PromiseDep: DependencyTree = {
      src: 'https://raw.githubusercontent.com/typings/typed-es6-promise/' +
      '94aac67ef7a14a8de8e9e1d3c1f9a26caa0d9fb1/typings.json',
      raw: 'github:typings/typed-es6-promise#94aac67ef7a14a8de8e9e1d3c1f9a26caa0d9fb1',
      main: 'dist/es6-promise.d.ts',
      browser: undefined,
      typings: undefined,
      browserTypings: undefined,
      version: undefined,
      files: undefined,
      global: undefined,
      postmessage: undefined,
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      globalDependencies: {},
      globalDevDependencies: {},
      name: 'es6-promise',
      type: 'typings'
    }

    const es6PromiseParent: DependencyTree = {
      src: join(cwd, 'jspm_packages/npm/unthenify@1.0.2/typings.json'),
      raw: 'jspm:unthenify',
      main: undefined,
      browser: undefined,
      typings: undefined,
      browserTypings: undefined,
      version: undefined,
      files: undefined,
      global: undefined,
      postmessage: undefined,
      dependencies: { 'es6-promise': es6PromiseDep },
      devDependencies: {},
      peerDependencies: {},
      globalDependencies: {},
      globalDevDependencies: {},
      name: undefined,
      type: 'typings'
    }

    const unthenifyDep: DependencyTree = {
      src: join(cwd, 'jspm_packages/npm/unthenify@1.0.2/package.json'),
      raw: 'jspm:unthenify',
      main: 'dist/index.js',
      browser: undefined,
      typings: undefined,
      browserTypings: undefined,
      version: '1.0.2',
      files: undefined,
      global: undefined,
      postmessage: undefined,
      dependencies: {
        'util-arity': utilArityDep,
        'es6-promise': es6PromiseDep
      },
      devDependencies: {},
      peerDependencies: {},
      globalDependencies: {},
      globalDevDependencies: {},
      name: 'unthenify'
    }

    return resolveDependency(jspmDep, { cwd, emitter })
      .then(actual => {
        t.is(actual.parent, undefined, 'top of result should have no parent')

        t.true(actual.dependencies['util-arity'], '`util-arity` is a dependency')
        const actualUtilArityParent = actual.dependencies['util-arity'].parent
        removeParentReference(actualUtilArityParent)
        t.deepEqual(actualUtilArityParent, utilArityParent, '`util-arity` has correct parent')

        t.true(actual.dependencies['es6-promise'], '`es6-promise` is a dependency')
        const actualEs6PromiseParent = actual.dependencies['es6-promise'].parent
        removeParentReference(actualEs6PromiseParent)
        t.deepEqual(actualEs6PromiseParent, es6PromiseParent, '`es6-promise` has correct parent')

        removeParentReference(actual)
        t.deepEqual(actual, unthenifyDep, 'result as expected (after parent removed to avoid circular reference)')
      })
  })
})

function removeParentReference(tree: DependencyTree) {
  delete tree.parent

  removeParentReferenceFromDependencies(tree.dependencies)
  removeParentReferenceFromDependencies(tree.devDependencies)
  removeParentReferenceFromDependencies(tree.peerDependencies)
  removeParentReferenceFromDependencies(tree.globalDependencies)
  removeParentReferenceFromDependencies(tree.globalDevDependencies)

  return tree
}

function removeParentReferenceFromDependencies(dependencies: DependencyBranch) {
  Object.keys(dependencies).forEach(function (key) {
    removeParentReference(dependencies[key])
  })
}
