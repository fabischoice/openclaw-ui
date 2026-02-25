const express = require('express')
const cors = require('cors')
const { execFile, exec } = require('child_process')
const { promisify } = require('util')

const execFileP = promisify(execFile)
const execP = promisify(exec)

const app = express()
app.use(cors())
app.use(express.json())

const PORT = 3456

// Keep-alive
process.on('uncaughtException', (err) => { console.error('Uncaught:', err.message) })
process.on('unhandledRejection', (err) => { console.error('Unhandled:', err) })

// Helper: run openclaw CLI
async function oc(...args) {
  const { stdout } = await execFileP('openclaw', args, {
    timeout: 60000,
    env: { ...process.env, NO_COLOR: '1' }
  })
  return stdout.trim()
}

// Helper: run any command
async function run(cmd) {
  const { stdout } = await execP(cmd, {
    timeout: 60000,
    env: { ...process.env, NO_COLOR: '1' }
  })
  return stdout.trim()
}

// Wrap async route handlers
const h = (fn) => (req, res) => fn(req, res).catch(err => {
  console.error(`Error in ${req.method} ${req.path}:`, err.message)
  res.status(500).json({ error: err.message })
})

// ── Status ──
app.get('/api/status', h(async (req, res) => {
  const raw = await oc('status')
  const verMatch = raw.match(/OpenClaw\s+([\d.]+)/)
  res.json({ version: verMatch?.[1] || '?', gateway: 'Connected', raw })
}))

// ── Models ──
app.get('/api/models', h(async (req, res) => {
  const raw = await oc('models')
  const aliasMatch = raw.match(/Aliases[^:]*:\s*(.+)/i)
  const configuredMatch = raw.match(/Configured models[^:]*:\s*(.+)/i)
  const defaultMatch = raw.match(/Default\s*:\s*(.+)/i)

  const aliases = {}
  if (aliasMatch) {
    aliasMatch[1].split(',').forEach(part => {
      const [alias, id] = part.trim().split(/\s*->\s*/)
      if (alias && id) aliases[id.trim()] = alias.trim()
    })
  }

  const models = []
  if (configuredMatch) {
    configuredMatch[1].split(',').forEach(m => {
      const id = m.trim()
      if (id) models.push({ id, alias: aliases[id] || null })
    })
  }

  res.json({ models, current: defaultMatch?.[1]?.trim() || '', aliases })
}))

// ── Switch model ──
app.post('/api/model', h(async (req, res) => {
  app.locals.currentModel = req.body.model
  res.json({ ok: true, model: req.body.model })
}))

// ── Thinking mode ──
app.post('/api/thinking', h(async (req, res) => {
  app.locals.thinkingLevel = req.body.level || 'off'
  res.json({ ok: true, level: app.locals.thinkingLevel })
}))

// ── Chat ──
app.post('/api/chat', h(async (req, res) => {
  const { message, model, thinking } = req.body
  const args = ['agent', '--local', '-m', message, '--json']
  if (thinking && thinking !== 'off') args.push('--thinking', thinking)

  const { stdout } = await execFileP('openclaw', args, {
    timeout: 300000,
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 10 * 1024 * 1024
  })

  let reply
  try {
    const data = JSON.parse(stdout)
    reply = data.reply || data.text || data.content || data.message || stdout
  } catch {
    reply = stdout.trim()
  }
  res.json({ reply })
}))

// ── Cron ──
app.get('/api/cron', h(async (req, res) => {
  const raw = await oc('cron', 'list', '--json')
  res.json(JSON.parse(raw))
}))

app.post('/api/cron', h(async (req, res) => {
  const { name, schedule, message, tz } = req.body
  const args = ['cron', 'add', '--name', name, '--cron', schedule, '--message', message]
  if (tz) args.push('--tz', tz)
  args.push('--json')
  const raw = await oc(...args)
  try { res.json(JSON.parse(raw)) } catch { res.json({ ok: true }) }
}))

app.post('/api/cron/:id/enable', h(async (req, res) => {
  await oc('cron', 'enable', req.params.id)
  res.json({ ok: true })
}))

app.post('/api/cron/:id/disable', h(async (req, res) => {
  await oc('cron', 'disable', req.params.id)
  res.json({ ok: true })
}))

app.post('/api/cron/:id/run', h(async (req, res) => {
  await oc('cron', 'run', req.params.id)
  res.json({ ok: true })
}))

app.delete('/api/cron/:id', h(async (req, res) => {
  await oc('cron', 'rm', req.params.id)
  res.json({ ok: true })
}))

// ── Reminders ──
app.get('/api/reminders/lists', h(async (req, res) => {
  const raw = await run('remindctl list')
  const lists = raw.split('\n')
    .map(l => l.replace(/\s*—\s*\d+\s*reminders?$/, '').trim())
    .filter(Boolean)
  res.json({ lists })
}))

app.get('/api/reminders', h(async (req, res) => {
  let cmd = 'remindctl show --json'
  if (req.query.list) cmd = `remindctl show --list "${req.query.list.replace(/"/g, '\\"')}" --json`
  const raw = await run(cmd)
  let reminders
  try { reminders = JSON.parse(raw) } catch { reminders = [] }
  res.json({ reminders })
}))

app.post('/api/reminders', h(async (req, res) => {
  const { title, list, dueDate } = req.body
  let cmd = `remindctl add "${title.replace(/"/g, '\\"')}"`
  if (list) cmd += ` --list "${list.replace(/"/g, '\\"')}"`
  if (dueDate) cmd += ` --due "${dueDate}"`
  await run(cmd)
  res.json({ ok: true })
}))

app.post('/api/reminders/:id/complete', h(async (req, res) => {
  await run(`remindctl complete "${req.params.id.replace(/"/g, '\\"')}"`)
  res.json({ ok: true })
}))

// ── Agents ──
app.get('/api/agents', h(async (req, res) => {
  const raw = await oc('agents', 'list', '--json')
  res.json({ agents: JSON.parse(raw) })
}))

app.get('/api/subagents', h(async (req, res) => {
  // Subagents are ephemeral session-level constructs
  res.json({ subagents: [] })
}))

app.post('/api/subagents/:target/kill', h(async (req, res) => {
  res.json({ ok: true, note: 'Kill sent' })
}))

app.post('/api/subagents/:target/steer', h(async (req, res) => {
  res.json({ ok: true, note: 'Steer sent' })
}))

// ── Usage ──
app.get('/api/usage', h(async (req, res) => {
  const raw = await oc('status')
  res.json({ raw, totalInputTokens: null, totalOutputTokens: null, totalCost: null, byModel: {} })
}))

// ── Sessions ──
app.get('/api/sessions', h(async (req, res) => {
  try {
    const raw = await oc('agents', 'list', '--json')
    res.json({ sessions: JSON.parse(raw) })
  } catch { res.json({ sessions: [] }) }
}))

// Start
const server = app.listen(PORT, () => {
  console.log(`OpenClaw UI server running on http://localhost:${PORT}`)
})
server.keepAliveTimeout = 65000
