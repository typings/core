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
  echo('Sorry, this script requires tsc');
  exit(1)
}

if (exec('tsc', {silent:true}).code !== 0) {
  echo('tsc completed intial build as expected')
  echo('')
}
else {
  echo('tsc completed without errors... that is unexpected and may merit investigation...')
  exit(1)
}

require("./").install({ cwd: process.cwd() })
