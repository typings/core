import { resolve } from 'path'
import test = require('blue-tape')
import fixture from 'blue-tape-fixture'
import { EventEmitter } from 'events'

import { resolveDependency } from './jspm'
import { DependencyTree } from '../interfaces'
import { removeParentReference } from '../utils/spec'
const ftest = fixture(test, 'src/lib/__test__/fixtures')
const emitter = new EventEmitter()

/* tslint:disable:max-line-length */

ftest('jspm resolve', 'jspm-typings-registry', (t, cwd) => {
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
    global: false,
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
    global: false,
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
    global: false,
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
    global: false,
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
    global: false,
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

  return resolveDependency(
    jspmDep,
    {
      cwd,
      emitter
    })
    .then(result => {
      // console.log(result)
      t.is(result.parent, undefined, 'top of result should have no parent')

      t.true(result.dependencies['any-promise'], '`any-promise` is a dependency')
      const actualAnyPromiseParent = result.dependencies['any-promise'].parent
      // console.log(actualAnyPromiseParent)
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

ftest.skip('jspm resolve', 'jspm-typings-github', (t, cwd) => {
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
    global: false,
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
    global: false,
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
    global: false,
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
    global: false,
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
    global: false,
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
    .then(result => {
      t.is(result.parent, undefined, 'top of result should have no parent')

      t.true(result.dependencies['util-arity'], '`util-arity` is a dependency')
      const actualUtilArityParent = result.dependencies['util-arity'].parent
      removeParentReference(actualUtilArityParent)
      t.deepEqual(actualUtilArityParent, utilArityParent, '`util-arity` has correct parent')

      t.true(result.dependencies['es6-promise'], '`es6-promise` is a dependency')
      const actualEs6PromiseParent = result.dependencies['es6-promise'].parent
      removeParentReference(actualEs6PromiseParent)
      t.deepEqual(actualEs6PromiseParent, es6PromiseParent, '`es6-promise` has correct parent')

      removeParentReference(result)
      t.deepEqual(result, unthenifyDep, 'result as expected (after parent removed to avoid circular reference)')
    })
})

// ftest('jspm readMetadata', 'jspm-0.17-custom', (t, fixturePath) => {
//   return readMetadata(resolve(fixturePath, 'package.json'))
//     .then((metadata) => {
//       t.deepEqual(metadata, {
//         name: undefined,
//         version: undefined,
//         main: undefined,
//         browser: undefined,
//         typings: undefined,
//         browserTypings: undefined,
//         configFiles: {
//           jspm: 'x/jspm.config.js',
//           node: undefined
//         },
//         packagePath: 'cust_packages',
//         paths: {
//           'npm:': 'cust_packages/npm/'
//         },
//         map: {
//           'domready': 'npm:domready@1.0.8'
//         },
//         packages: {
//         },
//         dependencies: {
//           'npm:domready@1.0.8': {
//             'deps': {},
//             'peerDeps': {}
//           }
//         }
//       })
//     })
// })

// ftest('jspm readMetadata', 'jspm-0.17', (t, fixturePath) => {
//   return readMetadata(join(fixturePath, 'package.json'))
//     .then((metadata) => {
//       t.deepEqual(metadata, {
//         name: undefined,
//         version: undefined,
//         main: undefined,
//         browser: undefined,
//         typings: undefined,
//         browserTypings: undefined,
//         configFiles: {
//           jspm: 'jspm.config.js',
//           node: undefined
//         },
//         packagePath: 'jspm_packages',
//         paths: {
//           'npm:': 'jspm_packages/npm/',
//           'github:': 'jspm_packages/github/'
//         },
//         map: {
//           'assert': 'github:jspm/nodelibs-assert@0.2.0-alpha',
//           'buffer': 'github:jspm/nodelibs-buffer@0.2.0-alpha',
//           'child_process': 'github:jspm/nodelibs-child_process@0.2.0-alpha',
//           'lodash': 'npm:lodash@4.13.1',
//           'process': 'github:jspm/nodelibs-process@0.2.0-alpha',
//           'sinon': 'npm:sinon@1.17.4',
//           'util': 'github:jspm/nodelibs-util@0.2.0-alpha',
//           'vm': 'github:jspm/nodelibs-vm@0.2.0-alpha'
//         },
//         packages: {
//           'github:jspm/nodelibs-buffer@0.2.0-alpha': {
//             'map': {
//               'buffer-browserify': 'npm:buffer@4.6.0'
//             }
//           },
//           'npm:buffer@4.6.0': {
//             'map': {
//               'isarray': 'npm:isarray@1.0.0',
//               'base64-js': 'npm:base64-js@1.1.2',
//               'ieee754': 'npm:ieee754@1.1.6'
//             }
//           },
//           'npm:sinon@1.17.4': {
//             'map': {
//               'formatio': 'npm:formatio@1.1.1',
//               'util': 'npm:util@0.10.3',
//               'samsam': 'npm:samsam@1.1.2',
//               'lolex': 'npm:lolex@1.3.2'
//             }
//           },
//           'npm:formatio@1.1.1': {
//             'map': {
//               'samsam': 'npm:samsam@1.1.3'
//             }
//           },
//           'npm:util@0.10.3': {
//             'map': {
//               'inherits': 'npm:inherits@2.0.1'
//             }
//           }
//         },
//         dependencies: {
//           'npm:lodash@4.13.1': {
//             'deps': {},
//             'peerDeps': {
//               'buffer': 'github:jspm/nodelibs-buffer@^0.2.0-alpha'
//             }
//           },
//           'npm:sinon@1.17.4': {
//             'deps': {
//               'formatio': 'npm:formatio@1.1.1',
//               'util': 'npm:util@0',
//               'lolex': 'npm:lolex@1.3.2',
//               'samsam': 'npm:samsam@1.1.2'
//             },
//             'peerDeps': {
//               'process': 'github:jspm/nodelibs-process@^0.2.0-alpha'
//             }
//           },
//           'npm:formatio@1.1.1': {
//             'deps': {
//               'samsam': 'npm:samsam@~1.1'
//             },
//             'peerDeps': {}
//           },
//           'npm:util@0.10.3': {
//             'deps': {
//               'inherits': 'npm:inherits@2.0.1'
//             },
//             'peerDeps': {
//               'assert': 'github:jspm/nodelibs-assert@^0.2.0-alpha',
//               'buffer': 'github:jspm/nodelibs-buffer@^0.2.0-alpha',
//               'child_process': 'github:jspm/nodelibs-child_process@^0.2.0-alpha',
//               'process': 'github:jspm/nodelibs-process@^0.2.0-alpha',
//               'vm': 'github:jspm/nodelibs-vm@^0.2.0-alpha'
//             }
//           },
//           'npm:samsam@1.1.3': {
//             'deps': {},
//             'peerDeps': {}
//           },
//           'npm:samsam@1.1.2': {
//             'deps': {},
//             'peerDeps': {}
//           },
//           'npm:lolex@1.3.2': {
//             'deps': {},
//             'peerDeps': {}
//           },
//           'npm:inherits@2.0.1': {
//             'deps': {},
//             'peerDeps': {
//               'util': 'github:jspm/nodelibs-util@^0.2.0-alpha'
//             }
//           },
//           'github:jspm/nodelibs-util@0.2.0-alpha': {
//             'deps': {},
//             'peerDeps': {
//               'process': 'github:jspm/nodelibs-process@^0.2.0-alpha'
//             }
//           },
//           'github:jspm/nodelibs-process@0.2.0-alpha': {
//             'deps': {},
//             'peerDeps': {}
//           },
//           'github:jspm/nodelibs-buffer@0.2.0-alpha': {
//             'deps': {
//               'buffer-browserify': 'npm:buffer@^4.0.0'
//             },
//             'peerDeps': {}
//           },
//           'npm:buffer@4.6.0': {
//             'deps': {
//               'base64-js': 'npm:base64-js@^1.0.2',
//               'ieee754': 'npm:ieee754@^1.1.4',
//               'isarray': 'npm:isarray@^1.0.0'
//             },
//             'peerDeps': {
//               'buffer': 'github:jspm/nodelibs-buffer@^0.2.0-alpha',
//               'process': 'github:jspm/nodelibs-process@^0.2.0-alpha'
//             }
//           },
//           'npm:isarray@1.0.0': {
//             'deps': {},
//             'peerDeps': {}
//           },
//           'npm:base64-js@1.1.2': {
//             'deps': {},
//             'peerDeps': {}
//           },
//           'npm:ieee754@1.1.6': {
//             'deps': {},
//             'peerDeps': {
//               'buffer': 'github:jspm/nodelibs-buffer@^0.2.0-alpha'
//             }
//           },
//           'github:jspm/nodelibs-child_process@0.2.0-alpha': {
//             'deps': {},
//             'peerDeps': {}
//           },
//           'github:jspm/nodelibs-vm@0.2.0-alpha': {
//             'deps': {},
//             'peerDeps': {}
//           },
//           'github:jspm/nodelibs-assert@0.2.0-alpha': {
//             'deps': {},
//             'peerDeps': {}
//           }
//         }
//       })
//     })
// })
