import { parseDependency } from './utils/parse'

export interface OpenOptions {
  homepage?: boolean
  issues?: boolean
}

export function open (raw: string, options: OpenOptions = {}): string {
  const dependency = parseDependency(raw)

  // TODO: Enable other expansions.

  return dependency.location
}
