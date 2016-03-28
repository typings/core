import test = require('blue-tape')
import Promise = require('any-promise')
import { join } from 'path'
import { prune } from './prune'
import { readFile, writeFile, mkdirp, isFile } from './utils/fs'

const BROWSER_AMBIENT_TYPINGS = 'typings/browser/ambient/test/index.d.ts'
const BROWSER_TYPINGS = 'typings/browser/definitions/test/index.d.ts'
const MAIN_AMBIENT_TYPINGS = 'typings/main/ambient/test/index.d.ts'
const MAIN_TYPINGS = 'typings/main/definitions/test/index.d.ts'
const BROWSER_INDEX = 'typings/browser.d.ts'
const MAIN_INDEX = 'typings/main.d.ts'

test('prune', t => {
  t.test('remove extraneous typings', t => {
    const FIXTURE_DIR = join(__dirname, '__test__/prune-extraneous')

    return generateTestDefinitions(FIXTURE_DIR)
      .then(() => {
         return prune({ cwd: FIXTURE_DIR })
      })
      .then(() => {
        return Promise.all([
          readFile(join(FIXTURE_DIR, BROWSER_INDEX), 'utf8'),
          readFile(join(FIXTURE_DIR, MAIN_INDEX), 'utf8'),
          isFile(join(FIXTURE_DIR, BROWSER_AMBIENT_TYPINGS)),
          isFile(join(FIXTURE_DIR, BROWSER_TYPINGS)),
          isFile(join(FIXTURE_DIR, MAIN_AMBIENT_TYPINGS)),
          isFile(join(FIXTURE_DIR, MAIN_TYPINGS))
        ])
      })
      .then(([
        browserDts,
        mainDts,
        hasBrowserAmbientDefinition,
        hasBrowserDefinition,
        hasMainAmbientDefinition,
        hasMainDefinition
      ]) => {
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

        t.equal(hasBrowserAmbientDefinition, true)
        t.equal(hasBrowserDefinition, true)
        t.equal(hasMainAmbientDefinition, true)
        t.equal(hasMainDefinition, true)
      })
  })

  t.test('remove all dev dependencies', t => {
    const FIXTURE_DIR = join(__dirname, '__test__/prune-production')

    return generateTestDefinitions(FIXTURE_DIR)
      .then(() => {
         return prune({
            cwd: FIXTURE_DIR,
            production: true
         })
      })
      .then(() => {
        return Promise.all([
          readFile(join(FIXTURE_DIR, BROWSER_INDEX), 'utf8'),
          readFile(join(FIXTURE_DIR, MAIN_INDEX), 'utf8'),
          isFile(join(FIXTURE_DIR, BROWSER_AMBIENT_TYPINGS)),
          isFile(join(FIXTURE_DIR, BROWSER_TYPINGS)),
          isFile(join(FIXTURE_DIR, MAIN_AMBIENT_TYPINGS)),
          isFile(join(FIXTURE_DIR, MAIN_TYPINGS))
        ])
      })
      .then(([
        browserDts,
        mainDts,
        hasBrowserAmbientDefinition,
        hasBrowserDefinition,
        hasMainAmbientDefinition,
        hasMainDefinition
      ]) => {
        t.equal(browserDts, `\n`)
        t.equal(mainDts, `\n`)

        t.equal(hasBrowserAmbientDefinition, false)
        t.equal(hasBrowserDefinition, false)
        t.equal(hasMainAmbientDefinition, false)
        t.equal(hasMainDefinition, false)
      })
  })
})

function generateTestDefinitions (directory: string) {
  const FAKE_AMBIENT_MODULE = `declare module 'test' {}\n`
  const FAKE_MODULE = `export function test (): boolean;\n`

  const dirs = [
    join(directory, 'typings/main/ambient/test'),
    join(directory, 'typings/browser/ambient/test'),
    join(directory, 'typings/main/definitions/test'),
    join(directory, 'typings/browser/definitions/test')
  ]

  return Promise.all(dirs.map(dir => mkdirp(dir)))
    .then(() => {
      return Promise.all([
        writeFile(join(directory, BROWSER_AMBIENT_TYPINGS), FAKE_AMBIENT_MODULE),
        writeFile(join(directory, BROWSER_TYPINGS), FAKE_MODULE),
        writeFile(join(directory, MAIN_AMBIENT_TYPINGS), FAKE_AMBIENT_MODULE),
        writeFile(join(directory, MAIN_TYPINGS), FAKE_MODULE),
        writeFile(join(directory, BROWSER_INDEX), [
          `/// <reference path="browser/ambient/test/index.d.ts" />`,
          `/// <reference path="browser/definitions/test/index.d.ts" />`,
          `/// <reference path="browser/definitions/extraneous/index.d.ts" />`,
          ``
        ].join('\n')),
        writeFile(join(directory, MAIN_INDEX), [
          `/// <reference path="main/ambient/test/index.d.ts" />`,
          `/// <reference path="main/definitions/test/index.d.ts" />`,
          `/// <reference path="main/definitions/extraneous/index.d.ts" />`,
          ``
        ].join('\n'))
      ])
    })
}
