import { resolve } from 'path'
import test = require('blue-tape')
import fixture from 'blue-tape-fixture'
import { EventEmitter } from 'events'

import { resolveDependency, resolveDependencies } from './jspm'
import { DependencyTree } from '../interfaces'
import { removeParentReference } from '../utils/spec'
const ftest = fixture(test, 'src/lib/__test__/fixtures')
const emitter = new EventEmitter()

/* tslint:disable:max-line-length */

ftest.skip('jspm resolveDependency', 'jspm-typings-registry', (t, cwd) => {
  const jspmDep = {
    raw: 'jspm:popsicle-retry',
    type: 'jspm',
    meta: {
      name: 'popsicle-retry'
    }
  }
  const xtendDep: DependencyTree = {
    src: resolve(cwd, 'jspm_packages/npm/xtend@4.0.1/package.json'),
    raw: 'jspm:xtend',
    main: 'immutable',
    browser: undefined,
    typings: undefined,
    browserTypings: undefined,
    version: '4.0.1',
    files: undefined,
    global: undefined,
    postmessage: undefined,
    dependencies: {},
    devDependencies: {},
    peerDependencies: {},
    globalDependencies: {},
    globalDevDependencies: {},
    name: 'xtend'
  }

  const xtendGithubDep: DependencyTree = {
    src: 'https://raw.githubusercontent.com/typed-typings/npm-xtend/63cccadf3295b3c15561ee45617ac006edcca9e0/typings.json',
    raw: 'registry:npm/xtend#4.0.0+20160211003958',
    main: 'immutable.d.ts',
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
    name: 'xtend',
    type: 'typings'
  }

  const xtendGithubParent: DependencyTree = {
    src: resolve(cwd, 'jspm_packages/npm/popsicle-retry@3.2.1/typings.json'),
    raw: 'jspm:popsicle-retry',
    main: undefined,
    browser: undefined,
    typings: undefined,
    browserTypings: undefined,
    version: undefined,
    files: undefined,
    global: undefined,
    postmessage: undefined,
    dependencies: {
      xtend: xtendGithubDep
    },
    devDependencies: {},
    peerDependencies: {},
    globalDependencies: {},
    globalDevDependencies: {},
    name: undefined,
    type: 'typings'
  }

  const anyPromiseDep: DependencyTree = {
    src: resolve(cwd, 'jspm_packages/npm/any-promise@1.3.0/package.json'),
    raw: 'jspm:any-promise',
    main: 'index.js',
    browser: {
      './register.js': './register-shim.js'
    },
    typings: 'index.d.ts',
    browserTypings: undefined,
    version: '1.3.0',
    files: undefined,
    global: undefined,
    postmessage: undefined,
    dependencies: {},
    devDependencies: {},
    peerDependencies: {},
    globalDependencies: {},
    globalDevDependencies: {},
    name: 'any-promise'
  }

  const anyPromiseParent: DependencyTree = {
    src: resolve(cwd, 'jspm_packages/npm/popsicle-retry@3.2.1/package.json'),
    raw: 'jspm:popsicle-retry',
    main: 'dist/index.js',
    browser: undefined,
    typings: undefined,
    browserTypings: undefined,
    version: '3.2.1',
    files: undefined,
    global: undefined,
    postmessage: undefined,
    dependencies: {
      'any-promise': anyPromiseDep,
      xtend: xtendDep
    },
    devDependencies: {},
    peerDependencies: {},
    globalDependencies: {},
    globalDevDependencies: {},
    name: 'popsicle-retry'
  }

  const popsicleRetryDep: DependencyTree = {
    src: resolve(cwd, 'jspm_packages/npm/popsicle-retry@3.2.1/package.json'),
    raw: 'jspm:popsicle-retry',
    main: 'dist/index.js',
    browser: undefined,
    typings: undefined,
    browserTypings: undefined,
    version: '3.2.1',
    files: undefined,
    global: undefined,
    postmessage: undefined,
    dependencies: {
      'any-promise': anyPromiseDep,
      'xtend': xtendGithubDep
    },
    devDependencies: {},
    peerDependencies: {},
    globalDependencies: {},
    globalDevDependencies: {},
    name: 'popsicle-retry'
  }

  return resolveDependency(
    jspmDep,
    {
      cwd,
      emitter
    })
    .then(result => {
      t.is(result.parent, undefined, 'top of result should have no parent')

      t.true(result.dependencies['any-promise'], '`any-promise` is a dependency')
      const actualAnyPromiseParent = result.dependencies['any-promise'].parent
      removeParentReference(actualAnyPromiseParent)
      t.deepEqual(actualAnyPromiseParent, anyPromiseParent, '`any-promise` has correct parent')

      const actualXtendDep = (result.dependencies as any).xtend
      t.true(actualXtendDep, '`xtend` is a dependency')
      const actualXtendParent = actualXtendDep.parent
      removeParentReference(actualXtendParent)
      t.deepEqual(actualXtendParent, xtendGithubParent, '`xtend` has correct parent')

      removeParentReference(result)
      t.deepEqual(result, popsicleRetryDep, 'result as expected (after parent removed to avoid circular reference)')
    })
})

ftest('jspm resolveDependency', 'jspm-typings-github', (t, cwd) => {
  const jspmDep = {
    raw: 'jspm:unthenify',
    type: 'jspm',
    meta: {
      name: 'unthenify'
    }
  }

  const utilArityDep: DependencyTree = {
    src: resolve(cwd, 'jspm_packages/npm/util-arity@1.0.2/package.json'),
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
    src: resolve(cwd, 'jspm_packages/npm/unthenify@1.0.2/package.json'),
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
    src: 'https://raw.githubusercontent.com/typings/typed-es6-promise/94aac67ef7a14a8de8e9e1d3c1f9a26caa0d9fb1/typings.json',
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
    src: resolve(cwd, 'jspm_packages/npm/unthenify@1.0.2/typings.json'),
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
    src: resolve(cwd, 'jspm_packages/npm/unthenify@1.0.2/package.json'),
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

  return resolveDependency(
    jspmDep,
    {
      cwd,
      emitter
    })
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

ftest.skip('jspm resolveDependencies', 'jspm-typings-registry', (t, cwd) => {
  return resolveDependencies({ cwd, emitter })
    .then(actual => {
      const xtendGithubDep: DependencyTree = {
        src: 'https://raw.githubusercontent.com/typed-typings/npm-xtend/63cccadf3295b3c15561ee45617ac006edcca9e0/typings.json',
        raw: 'registry:npm/xtend#4.0.0+20160211003958',
        main: 'immutable.d.ts',
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
        name: 'xtend',
        type: 'typings'
      }

      const anyPromiseDep: DependencyTree = {
        src: resolve(cwd, 'jspm_packages/npm/any-promise@1.3.0/package.json'),
        raw: 'jspm:any-promise',
        main: 'index.js',
        browser: {
          './register.js': './register-shim.js'
        },
        typings: 'index.d.ts',
        browserTypings: undefined,
        version: '1.3.0',
        files: undefined,
        global: undefined,
        postmessage: undefined,
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        globalDependencies: {},
        globalDevDependencies: {},
        name: 'any-promise'
      }

      const popsicleRetryDep: DependencyTree = {
        src: resolve(cwd, 'jspm_packages/npm/popsicle-retry@3.2.1/package.json'),
        raw: 'jspm:popsicle-retry',
        main: 'dist/index.js',
        browser: undefined,
        typings: undefined,
        browserTypings: undefined,
        version: '3.2.1',
        files: undefined,
        global: false,
        postmessage: undefined,
        dependencies: {
          'any-promise': anyPromiseDep,
          'xtend': xtendGithubDep
        },
        devDependencies: {},
        peerDependencies: {},
        globalDependencies: {},
        globalDevDependencies: {},
        name: 'popsicle-retry'
      }

      const processDep: DependencyTree = {
        src: '/Users/hwong/github/typings/core/src/lib/__test__/fixtures/jspm-typings-registry/jspm_packages/github/jspm/nodelibs-process@0.2.0-alpha/package.json',
        raw: 'jspm:process',
        main: './process.js',
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
        name: 'process'
      }
      const myModuleNode: DependencyTree = {
        src: 'src/lib/__test__/fixtures/jspm-typings-registry/package.json',
        raw: undefined,
        main: undefined,
        browser: undefined,
        typings: undefined,
        browserTypings: undefined,
        version: '0.1.2',
        files: undefined,
        global: undefined,
        postmessage: undefined,
        dependencies: {
          'popsicle-retry': popsicleRetryDep,
          process: processDep
        },
        devDependencies: {},
        peerDependencies: {},
        globalDependencies: {},
        globalDevDependencies: {},
        name: 'my-module'
      }
      removeParentReference(actual)
      t.deepEqual(actual, myModuleNode, 'result as expected (after parent removed to avoid circular reference)')
    })
})
