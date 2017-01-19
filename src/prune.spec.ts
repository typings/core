import test = require('blue-tape')
import { join } from 'path'
import { prune } from './prune'
import { readFile, writeFile, mkdirp, isFile } from './utils/fs'

const BROWSER_GLOBAL_TYPINGS = 'typings/browser/globals/test/index.d.ts'
const BROWSER_TYPINGS = 'typings/browser/modules/test/index.d.ts'
const MAIN_GLOBAL_TYPINGS = 'typings/main/globals/test/index.d.ts'
const MAIN_TYPINGS = 'typings/main/modules/test/index.d.ts'
const BROWSER_INDEX = 'typings/browser/index.d.ts'
const MAIN_INDEX = 'typings/main/index.d.ts'

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
          isFile(join(FIXTURE_DIR, BROWSER_GLOBAL_TYPINGS)),
          isFile(join(FIXTURE_DIR, BROWSER_TYPINGS)),
          isFile(join(FIXTURE_DIR, MAIN_GLOBAL_TYPINGS)),
          isFile(join(FIXTURE_DIR, MAIN_TYPINGS))
        ])
      })
      .then(([
        browserDts,
        mainDts,
        hasBrowserGlobalDefinition,
        hasBrowserDefinition,
        hasMainGlobalDefinition,
        hasMainDefinition
      ]) => {
        t.equal(browserDts, [
          `/// <reference path="globals/test/index.d.ts" />`,
          `/// <reference path="modules/test/index.d.ts" />`,
          ``
        ].join('\n'))

        t.equal(mainDts, [
          `/// <reference path="globals/test/index.d.ts" />`,
          `/// <reference path="modules/test/index.d.ts" />`,
          ``
        ].join('\n'))

        t.equal(hasBrowserGlobalDefinition, true)
        t.equal(hasBrowserDefinition, true)
        t.equal(hasMainGlobalDefinition, true)
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
          isFile(join(FIXTURE_DIR, BROWSER_GLOBAL_TYPINGS)),
          isFile(join(FIXTURE_DIR, BROWSER_TYPINGS)),
          isFile(join(FIXTURE_DIR, MAIN_GLOBAL_TYPINGS)),
          isFile(join(FIXTURE_DIR, MAIN_TYPINGS))
        ])
      })
      .then(([
        browserDts,
        mainDts,
        hasBrowserGlobalDefinition,
        hasBrowserDefinition,
        hasMainGlobalDefinition,
        hasMainDefinition
      ]) => {
        t.equal(browserDts, `\n`)
        t.equal(mainDts, `\n`)

        t.equal(hasBrowserGlobalDefinition, false)
        t.equal(hasBrowserDefinition, false)
        t.equal(hasMainGlobalDefinition, false)
        t.equal(hasMainDefinition, false)
      })
  })
})

function generateTestDefinitions (directory: string) {
  const FAKE_GLOBAL_MODULE = `declare module 'test' {}\n`
  const FAKE_MODULE = `export function test (): boolean;\n`

  const dirs = [
    join(directory, 'typings/main/globals/test'),
    join(directory, 'typings/browser/globals/test'),
    join(directory, 'typings/main/modules/test'),
    join(directory, 'typings/browser/modules/test')
  ]

  return Promise.all(dirs.map(dir => mkdirp(dir)))
    .then(() => {
      return Promise.all([
        writeFile(join(directory, BROWSER_GLOBAL_TYPINGS), FAKE_GLOBAL_MODULE),
        writeFile(join(directory, BROWSER_TYPINGS), FAKE_MODULE),
        writeFile(join(directory, MAIN_GLOBAL_TYPINGS), FAKE_GLOBAL_MODULE),
        writeFile(join(directory, MAIN_TYPINGS), FAKE_MODULE),
        writeFile(join(directory, BROWSER_INDEX), [
          `/// <reference path="globals/test/index.d.ts" />`,
          `/// <reference path="modules/test/index.d.ts" />`,
          `/// <reference path="modules/extraneous/index.d.ts" />`,
          ``
        ].join('\n')),
        writeFile(join(directory, MAIN_INDEX), [
          `/// <reference path="globals/test/index.d.ts" />`,
          `/// <reference path="modules/test/index.d.ts" />`,
          `/// <reference path="modules/extraneous/index.d.ts" />`,
          ``
        ].join('\n'))
      ])
    })
}
