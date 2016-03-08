require('shelljs/global')

echo('mkdir typings')
mkdir('-p', 'typings')
echo('')

echo('touch typings/main.d.ts')
touch('typings/main.d.ts')
echo('')

echo('SKIP_PREPUBLISH=true')
env['SKIP_PREPUBLISH'] = true
echo('')

echo('npm install')
exec('npm install')
echo('')

echo('rimraf dist')
exec('rimraf dist')
echo('')

if (!which('tsc')) {
  echo('This script requires tsc')
  exit(1)
}

if (exec('tsc', { silent: true }).code !== 0) {
  console.log('tsc completed build as expected')
  echo('')
}

require('../')
  .install({ cwd: process.cwd() })
  .then(function () {
    echo('Success!')
  })
