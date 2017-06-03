require('shelljs/global')

echo('npm install')
exec('npm install')
echo('')

echo('Using PATH:')
echo(process.env.PATH)
echo(ls('node_modules/.bin'))
echo('')

echo('mkdir typings')
mkdir('-p', 'typings')
echo('')

echo('touch typings/index.d.ts')
touch('typings/index.d.ts')
echo('')

echo('rimraf dist')
exec('rimraf dist')
echo('')

if (!which('tsc')) {
  echo('This script requires tsc')
  exit(1)
}

if (exec('tsc').code !== 0) {
  console.log('tsc completed build as expected')
  console.log('')
}

require('../')
  .install({ cwd: process.cwd() })
  .then(function () {
    console.log('Success!')
  })
  .catch(function (err) {
    console.log(err.toString())
    console.log(err.stack)
  })
