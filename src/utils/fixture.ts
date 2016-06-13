import test = require('blue-tape')
import { join } from 'path'

export interface FixtureTest {
  (name: string, fixtureName: string, cb: (t: test.Test, path: string) => any): test.Test
  only(name: string, fixtureName: string, cb: (t: test.Test, path: string) => any): test.Test
  skip(name: string, fixtureName: string, cb: (t: test.Test, path: string) => any): test.Test
}

export function fixture(path: string): FixtureTest {
  function curry(testfn: (name: string, cb: test.TestCase) => any) {
    return (
      title: string,
      fixtureName: string,
      cb: (t: test.Test, path: string) => any
    ) => {
      const fixturePath = join(path, fixtureName)
      return testfn(`${title} (fixture: ${fixtureName})`, t => {
        return cb(t, fixturePath)
      })
    }
  }
  let result: any = curry(test)
  result.only = curry(test.only)
  result.skip = curry(test.skip)
  return result as FixtureTest
}
