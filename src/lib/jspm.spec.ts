// import { join } from 'path'
import test = require('blue-tape')
import fixture from 'blue-tape-fixture'
import { EventEmitter } from 'events'

import { resolveDependency } from './jspm'

const ftest = fixture(test, 'src/lib/__test__/fixtures')
const emitter = new EventEmitter()

ftest.only('dependencies resolve', 'jspm-typings-github', (t, cwd) => {
  const jspmDep = {
    raw: 'jspm:unthenify',
    type: 'jspm',
    meta: {
      name: 'unthenify'
    }
  }
  return resolveDependency(
    jspmDep,
    {
      cwd,
      emitter
    })
    .then(value => {
      console.log(value)
    })
})

// ftest('jspm readMetadata', 'jspm-0.17-custom', (t, fixturePath) => {
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
