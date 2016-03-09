// This file contains patches to make `node.d.ts` compile with `noLib`.

declare class Intl {

}

declare const console: {
  log (...args: any[]): void
  warn (...args: any[]): void
  error (...args: any[]): void
}