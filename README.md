# Typings Core

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]

> The core logic for Typings.

## Usage

```ts
import * as typings from 'typings-core'
```

## Contributing

```sh
# Installation
# Fork this repo (https://github.com/typings/typings-core)
# Clone the fork (E.g. `https://github.com/<your_username>/typings-core.git`)
cd typings-core
npm run bootstrap

# You will see errors such as "src/bundle.ts(1,26): error TS2307: Cannot find module 'any-promise'"
# Just ignore them. "npm run build" and "npm run test" will work correctly

# Build
npm run build

# Test
npm run test
```

## License

MIT

[npm-image]: https://img.shields.io/npm/v/typings-core.svg?style=flat
[npm-url]: https://npmjs.org/package/typings-core
[downloads-image]: https://img.shields.io/npm/dm/typings-core.svg?style=flat
[downloads-url]: https://npmjs.org/package/typings-core
[travis-image]: https://img.shields.io/travis/typings/core.svg?style=flat
[travis-url]: https://travis-ci.org/typings/core
[coveralls-image]: https://img.shields.io/coveralls/typings/core.svg?style=flat
[coveralls-url]: https://coveralls.io/r/typings/core?branch=master
