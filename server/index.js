const express = require('express')
const cors = require('cors')
const { execFile, exec } = require('child_process')
const { promisify } = require('util')
const http = require('http')
const fs = require('fs')
const path = require('path')

const execFileP = promisify(execFile)
const execP = promisify(exec)

const app = express()
app.use(cors())
app.use(express.json())

const PORT = 3456
const OPENCLAW_HOME = path.join(process.env.HOME, '.openclaw')

// Keep-alive
process.on('uncaughtException', (err) => console.error('Uncaught:', err.message))
process.on('unhandledRejection', (err) => console.error('Unhandled:', err))

// ── Helpers ──
async function oc(...args) {
  const { stdout } = await execFileP('openclaw', args, {
    timeout: 300000,
    env: { ...process.env, NO_COLOR: '1' }
  })
  return stdout.trim()
}

async function run(cmd) {
  const { stdout } = await execP(cmd, {
    timeout: 60000,
    env: { ...process.env, NO_COLOR: '1' }
  })
  return stdout.trim()
}

const h = (fn) => (req, res) => fn(req, res).catch(err => {
  console.error(`Error in ${req.method} ${req.path}:`, err.message)
  res.status(500).json({ error: err.message })
})

// ── Session helpers ──
function getSessionsPath(agentId = 'main') {
  return path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json')
}

function getActiveSessions(agentId = 'main') {
  try {
    const raw = fs.readFileSync(getSessionsPath(agentId), 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : (data.sessions || [])
  } catch { return [] }
}

function getMainSession(agentId = 'main') {
  const sessions = getActiveSessions(agentId)
  if (!sessions.length) return null
  // Return most recently updated session
  return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
}

function getJSONLPath(agentId, sessionId) {
  return path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', `${sessionId}.jsonl`)
}

function readJSONLMessages(filePath, limit = 200) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const messages = []
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.type !== 'message') continue
        const msg = entry.message
        if (!msg) continue

        // User messages
        if (msg.role === 'user') {
          const text = Array.isArray(msg.content)
            ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('')
            : msg.content || ''
          if (text.trim()) messages.push({ role: 'user', content: text, ts: entry.timestamp })
        }
        // Assistant messages (skip thinking, tool calls)
        else if (msg.role === 'assistant') {
          const parts = Array.isArray(msg.content)
            ? msg.content.filter(c => c.type === 'text').map(c => c.text)
            : [msg.content || '']
          const text = parts.join('').trim()
          if (text) messages.push({ role: 'assistant', content: text, ts: entry.timestamp })
        }
      } catch {}
    }
    return messages.slice(-limit)
  } catch { return [] }
}

// ── Status ──
app.get('/api/status', h(async (req, res) => {
  const raw = await oc('status')
  const verMatch = raw.match(/OpenClaw\s+([\d.]+)/)
  res.json({ version: verMatch?.[1] || '?', gateway: 'Connected', raw })
}))

// ── Models ──
app.get('/api/models', h(async (req, res) => {
  const raw = await oc('models')
  // Parse JSON models list
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) return res.json({ models: JSON.parse(jsonMatch[0]), current: '' })
  } catch {}

  // Fallback: parse text
  const defaultMatch = raw.match(/Default\s*[:\-]\s*(.+)/i)
  const lines = raw.split('\n')
  const models = []
  for (const line of lines) {
    const m = line.match(/^\s*([\w\-\/]+\/[\w\-\.]+)/)
    if (m) {
      const aliasM = line.match(/alias[:\s]+(\w+)/i)
      models.push({ id: m[1], alias: aliasM?.[1] || null })
    }
  }
  res.json({ models, current: defaultMatch?.[1]?.trim() || '' })
}))

// Also expose as /api/models/list for the frontend
app.get('/api/models/list', h(async (req, res) => {
  const agentsRaw = await oc('agents', 'list', '--json')
  const agents = JSON.parse(agentsRaw)
  const configPath = path.join(OPENCLAW_HOME, 'openclaw.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const configuredModels = Object.keys(config?.agents?.defaults?.models || {})
  const models = configuredModels.map(id => {
    const alias = config.agents.defaults.models[id]?.alias || null
    return { id, alias }
  })
  res.json({ models, current: config?.agents?.defaults?.model?.primary || '' })
}))

app.post('/api/model', h(async (req, res) => {
  app.locals.currentModel = req.body.model
  res.json({ ok: true, model: req.body.model })
}))

// ── Chat history ──
app.get('/api/chat/history', h(async (req, res) => {
  const agentId = req.query.agent || 'main'
  const session = getMainSession(agentId)
  if (!session) return res.json({ messages: [], sessionId: null })
  const filePath = getJSONLPath(agentId, session.sessionId)
  const messages = readJSONLMessages(filePath, 100)
  res.json({ messages, sessionId: session.sessionId, sessionKey: session.key })
}))

// ── SSE: live message feed ──
const sseClients = {}

app.get('/api/chat/stream', (req, res) => {
  const agentId = req.query.agent || 'main'
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const clientId = Date.now()
  if (!sseClients[agentId]) sseClients[agentId] = {}
  sseClients[agentId][clientId] = res

  // Watch the JSONL file for changes
  const session = getMainSession(agentId)
  let watcher = null
  let lastSize = 0
  let lastMessages = []

  const checkForNew = () => {
    if (!session) return
    const filePath = getJSONLPath(agentId, session.sessionId)
    try {
      const stat = fs.statSync(filePath)
      if (stat.size === lastSize) return
      lastSize = stat.size
      const messages = readJSONLMessages(filePath, 100)
      if (messages.length !== lastMessages.length) {
        lastMessages = messages
        res.write(`data: ${JSON.stringify({ type: 'history', messages })}\n\n`)
      }
    } catch {}
  }

  if (session) {
    const filePath = getJSONLPath(agentId, session.sessionId)
    lastMessages = readJSONLMessages(filePath, 100)
    res.write(`data: ${JSON.stringify({ type: 'history', messages: lastMessages })}\n\n`)
    // Poll every second for new messages
    watcher = setInterval(checkForNew, 1000)
  }

  // Heartbeat
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000)

  req.on('close', () => {
    clearInterval(heartbeat)
    if (watcher) clearInterval(watcher)
    if (sseClients[agentId]) delete sseClients[agentId][clientId]
  })
})

// ── Send chat message ──
app.post('/api/chat', h(async (req, res) => {
  const { message, model, thinking, agent: agentId = 'main' } = req.body
  const session = getMainSession(agentId)

  const args = ['agent', '--local', '-m', message, '--json']
  if (session?.sessionId) args.push('--session-id', session.sessionId)
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

app.post('/api/cron/:id/enable', h(async (req, res) => { await oc('cron', 'enable', req.params.id); res.json({ ok: true }) }))
app.post('/api/cron/:id/disable', h(async (req, res) => { await oc('cron', 'disable', req.params.id); res.json({ ok: true }) }))
app.post('/api/cron/:id/run', h(async (req, res) => { await oc('cron', 'run', req.params.id); res.json({ ok: true }) }))
app.delete('/api/cron/:id', h(async (req, res) => { await oc('cron', 'rm', req.params.id); res.json({ ok: true }) }))

// ── Reminders ──
app.get('/api/reminders/lists', h(async (req, res) => {
  const raw = await run('remindctl list')
  const lists = raw.split('\n').map(l => l.replace(/\s*—\s*\d+\s*reminders?$/, '').trim()).filter(Boolean)
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

app.post('/api/agents', h(async (req, res) => {
  const { name, emoji, model, description } = req.body
  if (!name) return res.status(400).json({ error: 'Nombre requerido' })
  const listRaw = await oc('agents', 'list', '--json')
  const existing = JSON.parse(listRaw)
  if (existing.length >= 8) return res.status(400).json({ error: 'Máximo 8 agents permitidos' })
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const workspace = path.join(OPENCLAW_HOME, 'agents', id, 'workspace')
  const args = ['agents', 'add', id, '--non-interactive', '--workspace', workspace]
  if (model) args.push('--model', model)
  await oc(...args)
  if (name || emoji) {
    const idArgs = ['agents', 'set-identity', id]
    if (name) idArgs.push('--name', name)
    if (emoji) idArgs.push('--emoji', emoji)
    try { await oc(...idArgs) } catch {}
  }
  res.json({ ok: true, id })
}))

app.get('/api/subagents', h(async (req, res) => { res.json({ subagents: [] }) }))
app.post('/api/subagents/:target/kill', h(async (req, res) => { res.json({ ok: true }) }))
app.post('/api/subagents/:target/steer', h(async (req, res) => { res.json({ ok: true }) }))

// ── Usage ──
app.get('/api/usage', h(async (req, res) => {
  const raw = await oc('status')
  res.json({ raw, sessions: [] })
}))

// ── Sessions ──
app.get('/api/sessions', h(async (req, res) => {
  try {
    const raw = await oc('agents', 'list', '--json')
    res.json({ sessions: JSON.parse(raw) })
  } catch { res.json({ sessions: [] }) }
}))

// Start
const server = http.createServer(app)
server.listen(PORT, () => console.log(`OpenClaw UI server running on http://localhost:${PORT}`))
server.keepAliveTimeout = 65000
