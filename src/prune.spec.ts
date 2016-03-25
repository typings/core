import test = require('blue-tape')
import Promise = require('any-promise')
import { join } from 'path'
import { EventEmitter } from 'events'
import { prune } from './prune'
import { readFile, writeFile, mkdirp, isFile } from './utils/fs'
import { CONFIG_FILE } from './utils/config'
import { VERSION } from './typings'

const emitter = new EventEmitter()

const EXTRA_BROWSER_AMBIENT_TYPINGS = 'typings/browser/ambient/extraneous/index.d.ts'
const EXTRA_BROWSER_TYPINGS = 'typings/browser/definitions/extraneous/index.d.ts'
const EXTRA_MAIN_AMBIENT_TYPINGS = 'typings/main/ambient/extraneous/index.d.ts'
const EXTRA_MAIN_TYPINGS = 'typings/main/definitions/extraneous/index.d.ts'
const BROWSER_INDEX = 'typings/browser.d.ts'
const MAIN_INDEX = 'typings/main.d.ts'

test('prune', t => {
  t.test('remove extraneous typings', t => {
    const FIXTURE_DIR = join(__dirname, '__test__/prune-extraneous')

    return generateExtraneousDefinitions(FIXTURE_DIR)
      .then(() => {
         return prune({
            cwd: FIXTURE_DIR,
            emitter
         })
      })
      .then(() => {
        return Promise.all([
          readFile(join(FIXTURE_DIR, BROWSER_INDEX), 'utf8'),
          readFile(join(FIXTURE_DIR, MAIN_INDEX), 'utf8'),
          isFile(join(FIXTURE_DIR, 'typings/browser/ambient/test/index.d.ts')),
          isFile(join(FIXTURE_DIR, 'typings/browser/definitions/test/index.d.ts')),
          isFile(join(FIXTURE_DIR, 'typings/main/ambient/test/index.d.ts')),
          isFile(join(FIXTURE_DIR, 'typings/main/definitions/test/index.d.ts')),
          isFile(join(FIXTURE_DIR, EXTRA_BROWSER_AMBIENT_TYPINGS)),
          isFile(join(FIXTURE_DIR, EXTRA_BROWSER_TYPINGS)),
          isFile(join(FIXTURE_DIR, EXTRA_MAIN_AMBIENT_TYPINGS)),
          isFile(join(FIXTURE_DIR, EXTRA_MAIN_TYPINGS))
        ])
      })
      .then(([browserDts, mainDts,
              hasBrowserAmbientDefinition, hasBrowserDefinition,
              hasMainAmbientDefinition, hasMainDefinition,
              hasExtBrowserAmbientDefinition, hasExtBrowserDefinition,
              hasExtMainAmbientDefinition, hasExtMainDefinition]) => {
        t.equal(browserDts, [
          `/// <reference path="browser/ambient/test/index.d.ts" />`,
          `/// <reference path="browser/definitions/test/index.d.ts" />`,
          ``
        ].join('\n'))
        t.equal(mainDts, [
          `/// <reference path="main/ambient/test/index.d.ts" />`,
          `/// <reference path="main/definitions/test/index.d.ts" />`,
          ``
        ].join('\n'))

        const FILE_IS_PRESENT = true;

        t.equal(hasBrowserAmbientDefinition, FILE_IS_PRESENT)
        t.equal(hasBrowserDefinition, FILE_IS_PRESENT)
        t.equal(hasMainAmbientDefinition, FILE_IS_PRESENT)
        t.equal(hasMainDefinition, FILE_IS_PRESENT)

        const FILE_IS_PRUNED = false;

        t.equal(hasExtBrowserAmbientDefinition, FILE_IS_PRUNED)
        t.equal(hasExtBrowserDefinition, FILE_IS_PRUNED)
        t.equal(hasExtMainAmbientDefinition, FILE_IS_PRUNED)
        t.equal(hasExtMainDefinition, FILE_IS_PRUNED)
      })
  })

  t.test('remove all dev dependencies', t => {
    const FIXTURE_DIR = join(__dirname, '__test__/prune-prod')

    return generateExtraneousDefinitions(FIXTURE_DIR)
      .then(() => {
         return prune({
            cwd: FIXTURE_DIR,
            production: true,
            emitter
         })
      })
      .then(() => {
        return Promise.all([
          readFile(join(FIXTURE_DIR, BROWSER_INDEX), 'utf8'),
          readFile(join(FIXTURE_DIR, MAIN_INDEX), 'utf8'),
          isFile(join(FIXTURE_DIR, EXTRA_BROWSER_AMBIENT_TYPINGS)),
          isFile(join(FIXTURE_DIR, EXTRA_BROWSER_TYPINGS)),
          isFile(join(FIXTURE_DIR, EXTRA_MAIN_AMBIENT_TYPINGS)),
          isFile(join(FIXTURE_DIR, EXTRA_MAIN_TYPINGS))
        ])
      })
      .then(([browserDts, mainDts,
              hasExtBrowserAmbientDefinition, hasExtBrowserDefinition,
              hasExtMainAmbientDefinition, hasExtMainDefinition]) => {
        t.equal(browserDts, ``)
        t.equal(mainDts, ``)

        const FILE_IS_PRUNED = false;

        t.equal(hasExtBrowserAmbientDefinition, FILE_IS_PRUNED)
        t.equal(hasExtBrowserDefinition, FILE_IS_PRUNED)
        t.equal(hasExtMainAmbientDefinition, FILE_IS_PRUNED)
        t.equal(hasExtMainDefinition, FILE_IS_PRUNED)
      })
  })
})

function generateExtraneousDefinitions(directory: string) {
  const FAKE_AMBIENT_MODULE = [
      `declare module "x" {}`,
      ``
  ].join('\n')

  const FAKE_MODULE = [
   `declare module 'test' {`,
   `  function test (): boolean`,
   ``,
   `  export default test`,
   `}`,
   ``
  ].join('\n')

  const newDirectories = [
    join(directory, 'typings/browser/ambient/extraneous'),
    join(directory, 'typings/browser/definitions/extraneous'),
    join(directory, 'typings/main/ambient/extraneous'),
    join(directory, 'typings/main/definitions/extraneous')
  ]

  return Promise.all(
    newDirectories.map(dir => mkdirp)
  )
    .then(() => {
      return Promise.all([
        writeFile(join(directory, EXTRA_BROWSER_AMBIENT_TYPINGS), FAKE_AMBIENT_MODULE),
        writeFile(join(directory, EXTRA_BROWSER_TYPINGS), FAKE_MODULE),
        writeFile(join(directory, EXTRA_MAIN_AMBIENT_TYPINGS), FAKE_AMBIENT_MODULE),
        writeFile(join(directory, EXTRA_MAIN_TYPINGS), FAKE_MODULE),
        writeFile(join(directory, BROWSER_INDEX), [
          `/// <reference path="browser/ambient/extraneous/index.d.ts" />`,
          `/// <reference path="browser/definitions/extraneous/index.d.ts" />`,
          `/// <reference path="browser/ambient/test/index.d.ts" />`,
          `/// <reference path="browser/definitions/test/index.d.ts" />`,
          ``
        ].join('\n')),
        writeFile(join(directory, MAIN_INDEX), [
          `/// <reference path="main/ambient/extraneous/index.d.ts" />`,
          `/// <reference path="main/definitions/extraneous/index.d.ts" />`,
          `/// <reference path="main/ambient/test/index.d.ts" />`,
          `/// <reference path="main/definitions/test/index.d.ts" />`,
          ``
        ].join('\n'))
      ])
    })
}
