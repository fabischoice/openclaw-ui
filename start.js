// start.js — Launch server + vite as detached background processes
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const root = __dirname
const logDir = '/tmp'

function launch(name, cmd, args) {
  const log = fs.openSync(path.join(logDir, `openclaw-ui-${name}.log`), 'w')
  const child = spawn(cmd, args, {
    cwd: root,
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env }
  })
  child.unref()
  console.log(`✅ ${name} started (pid ${child.pid}) → log: /tmp/openclaw-ui-${name}.log`)
  return child.pid
}

// Kill existing
require('child_process').execSync('pkill -f "node server/index" 2>/dev/null; pkill -f "vite" 2>/dev/null; sleep 1', { stdio: 'ignore', shell: true })

const serverPid = launch('server', 'node', ['server/index.js'])
const vitePid = launch('vite', 'node', [path.join(root, 'node_modules/.bin/vite')])

// Save pids
fs.writeFileSync('/tmp/openclaw-ui.pid', JSON.stringify({ server: serverPid, vite: vitePid }))

console.log('\n🌺 OpenClaw UI running:')
console.log('   Frontend → http://localhost:5173/')
console.log('   Backend  → http://localhost:3456/')
console.log('\n   Stop: kill $(cat /tmp/openclaw-ui.pid | node -e "const d=JSON.parse(require(\'fs\').readFileSync(\'/dev/stdin\',\'utf8\')); process.stdout.write(d.server+\' \'+d.vite)")')
