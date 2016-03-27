import { resolve, relative, normalize } from 'path'
import isAbsolute = require('is-absolute')
import { normalizeSlashes, EOL } from './path'
import { MAIN_TYPINGS_DIR, BROWSER_TYPINGS_DIR, DEFINITIONS_DIR, AMBIENT_DEFINITIONS_DIR } from './config'

/**
 * Match reference tags in a file. Matching the newline before the
 * reference to remove unwanted data when removing the line from the file.
 */
export const REFERENCE_REGEXP = /^\/\/\/[ \t]*<reference[ \t]+path[ \t]*=("|')(.*?)\1.*?\/>[ \t]*\r?\n?/gm

/**
 * References come back in a semi-useful structure to enable slicing them
 * from the source code that was passed in.
 */
export interface Reference {
  start: number
  end: number
  path: string
}

export function extractReferences (contents: string, cwd: string): Reference[] {
  const refs: Reference[] = []
  let m: RegExpExecArray

  while ((m = REFERENCE_REGEXP.exec(contents)) != null) {
    refs.push({
      start: m.index,
      end: m.index + m[0].length,
      path: resolve(cwd, m[2])
    })
  }

  return refs
}

export function parseReferences (contents: string, cwd: string): string[] {
  return extractReferences(contents, cwd).map(ref => resolve(cwd, ref.path))
}

export function stringifyReferences (paths: string[], cwd: string): string {
  return paths.map(path => toReference(path, cwd)).join(EOL) + EOL
}

export function toReference (path: string, cwd: string): string {
  return `/// <reference path="${normalizeSlashes(isAbsolute(path) ? relative(cwd, path) : normalize(path))}" />`
}

export enum DependencyTarget {
  Main,
  Browser
}

export enum DependencyType {
  Ambient,
  External
}

export interface DependencyInfo {
  target: DependencyTarget
  type: DependencyType
  name: string
}

export function parseReferencePath(path: string): DependencyInfo {
  const referencePathRegexPattern =
    `\\/(` + MAIN_TYPINGS_DIR + `|` + BROWSER_TYPINGS_DIR + `)` +
    `\\/(` + DEFINITIONS_DIR + `|` + AMBIENT_DEFINITIONS_DIR + `)` +
    `\\/(\\w+)\\/`
  const referencePathRegex = new RegExp(referencePathRegexPattern)
  const matchResults = referencePathRegex.exec(path)

  if (matchResults) {
    const [, mainOrBrowser, ambientOrExternal, name] = matchResults
    const target = mainOrBrowser === MAIN_TYPINGS_DIR
      ? DependencyTarget.Main
      : DependencyTarget.Browser

    const type = ambientOrExternal === DEFINITIONS_DIR
      ? DependencyType.External
      : DependencyType.Ambient

    return {
      target,
      type,
      name
    }
  }

  return null
}
