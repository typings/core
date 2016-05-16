import test = require('blue-tape')
import Promise = require('any-promise')
import { join } from 'path'
import { EventEmitter } from 'events'
import nock = require('nock')
import { install, installDependencyRaw } from './install'
import { readFile, readConfig, writeFile, rimraf } from './utils/fs'
import { CONFIG_FILE } from './utils/config'
import rc from './utils/rc'

test('install', t => {
  const emitter = new EventEmitter()

  t.test('install everything', t => {
    const FIXTURE_DIR = join(__dirname, '__test__/install-fixture')

    return rimraf(join(FIXTURE_DIR, 'typings'))
      .then(() => {
        return install({
          cwd: FIXTURE_DIR,
          emitter
        })
      })
      .then(function () {
        return Promise.all([
          readFile(join(FIXTURE_DIR, 'typings/index.d.ts'), 'utf8'),
          readFile(join(FIXTURE_DIR, 'typings/modules/test/index.d.ts'), 'utf8'),
          readFile(join(FIXTURE_DIR, 'typings/globals/test/index.d.ts'), 'utf8')
        ])
      })
      .then(function ([mainDts, mainFile, globalMainFile]) {
        t.equal(mainDts, [
          `/// <reference path="globals/test/index.d.ts" />`,
          `/// <reference path="modules/test/index.d.ts" />`,
          ``
        ].join('\n'))

        t.equal(mainFile, [
          `// Generated by typings`,
          `// Source: custom_typings/module.d.ts`,
          `declare module \'test\' {`,
          `function test (): boolean`,
          ``,
          `export default test`,
          `}`,
          ``
        ].join('\n'))

        t.equal(globalMainFile, [
          `// Generated by typings`,
          `// Source: custom_typings/global.d.ts`,
          `declare module "x" {}`
        ].join('\n'))
      })
  })

  t.test('install dependency', t => {
    const DEPENDENCY = '@scope/test=file:custom_typings/module.d.ts'
    const REGISTRY_DEPENDENCY = 'registry:dt/node@>=4.0'
    const PEER_DEPENDENCY = 'file:custom_typings/named/typings.json'
    const GLOBAL_DEPENDENCY = 'file:custom_typings/global.d.ts'
    const FIXTURE_DIR = join(__dirname, '__test__/install-dependency-fixture')
    const CONFIG = join(FIXTURE_DIR, CONFIG_FILE)

    nock(rc.registryURL)
      .get('/entries/dt/node/versions/%3E%3D4.0/latest')
      .reply(200, {
        tag: '4.0.0+20160226132328',
        version: '4.0.0',
        description: null,
        compiler: null,
        location: 'github:DefinitelyTyped/DefinitelyTyped/node/node.d.ts#48c1e3c1d6baefa4f1a126f188c27c4fefd36bff',
        updated: '2016-02-26T13:23:28.000Z'
      })

    nock('http://raw.githubusercontent.com/')
      .get('/DefinitelyTyped/DefinitelyTyped/48c1e3c1d6baefa4f1a126f188c27c4fefd36bff/node/node.d.ts')
      .reply(200, '// Type definitions for Node.js v4.x')

    return writeFile(CONFIG, '{}')
      .then(function () {
        return rimraf(join(FIXTURE_DIR, 'typings'))
      })
      .then(function () {
        return Promise.all([
          installDependencyRaw(DEPENDENCY, {
            cwd: FIXTURE_DIR,
            saveDev: true,
            emitter
          }),
          installDependencyRaw(REGISTRY_DEPENDENCY, {
            cwd: FIXTURE_DIR,
            save: true,
            global: true,
            emitter
          }),
          installDependencyRaw(GLOBAL_DEPENDENCY, {
            cwd: FIXTURE_DIR,
            saveDev: true,
            global: true,
            emitter
          }),
          installDependencyRaw(PEER_DEPENDENCY, {
            cwd: FIXTURE_DIR,
            savePeer: true,
            emitter
          })
        ])
      })
      .then(function () {
        return readConfig(CONFIG)
      })
      .then(function (config) {
        t.deepEqual(config, {
          devDependencies: {
            '@scope/test': 'file:custom_typings/module.d.ts'
          },
          peerDependencies: {
            named: PEER_DEPENDENCY
          },
          globalDependencies: {
            node: 'registry:dt/node#4.0.0+20160226132328'
          },
          globalDevDependencies: {
            global: 'file:custom_typings/global.d.ts'
          }
        })
      })
  })

  t.test('install empty', t => {
    const FIXTURE_DIR = join(__dirname, '__test__/install-empty')

    return install({
      cwd: FIXTURE_DIR,
      emitter
    })
      .then(function () {
        return Promise.all([
          readFile(join(FIXTURE_DIR, 'typings/main/index.d.ts'), 'utf8'),
          readFile(join(FIXTURE_DIR, 'typings/browser/index.d.ts'), 'utf8')
        ])
      })
      .then(function ([main, browser]) {
        t.equal(main, '')
        t.equal(browser, '')
      })
  })
})
