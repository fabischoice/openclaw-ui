const express = require('express')
const cors = require('cors')
const { execFile, exec } = require('child_process')
const { promisify } = require('util')
const path = require('path')

const execFileP = promisify(execFile)
const execP = promisify(exec)

const app = express()
app.use(cors())
app.use(express.json())

const PORT = 3456

// Helper: run openclaw CLI
async function oc(...args) {
  try {
    const { stdout } = await execFileP('openclaw', args, {
      timeout: 60000,
      env: { ...process.env, NO_COLOR: '1' }
    })
    return stdout.trim()
  } catch (err) {
    throw new Error(err.stderr?.trim() || err.message)
  }
}

// Helper: run any command
async function run(cmd) {
  try {
    const { stdout } = await execP(cmd, {
      timeout: 60000,
      env: { ...process.env, NO_COLOR: '1' }
    })
    return stdout.trim()
  } catch (err) {
    throw new Error(err.stderr?.trim() || err.message)
  }
}

// ── Status ──
app.get('/api/status', async (req, res) => {
  try {
    const raw = await oc('status')
    // Extract version
    const verMatch = raw.match(/OpenClaw\s+([\d.]+)/)
    res.json({
      version: verMatch?.[1] || '?',
      gateway: 'Connected',
      raw
    })
  } catch (err) {
    res.json({ version: '?', gateway: 'Error', error: err.message })
  }
})

// ── Models ──
app.get('/api/models', async (req, res) => {
  try {
    const raw = await oc('models')
    // Parse configured models and aliases
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

    const current = defaultMatch?.[1]?.trim() || ''

    res.json({ models, current, aliases })
  } catch (err) {
    res.json({ models: [], current: '', error: err.message })
  }
})

// ── Switch model ──
app.post('/api/model', async (req, res) => {
  try {
    const { model } = req.body
    // Use openclaw config to set the model
    // For now we'll track it in memory and pass to agent calls
    app.locals.currentModel = model
    res.json({ ok: true, model })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Thinking mode ──
app.post('/api/thinking', async (req, res) => {
  const { level } = req.body
  app.locals.thinkingLevel = level || 'off'
  res.json({ ok: true, level: app.locals.thinkingLevel })
})

// ── Chat ──
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model, thinking } = req.body
    const args = ['agent', '--local', '-m', message, '--json']

    const useModel = model || app.locals.currentModel
    // We don't pass model directly since --local uses whatever is configured;
    // instead pass thinking level
    if (thinking && thinking !== 'off') {
      args.push('--thinking', thinking)
    }

    const { stdout, stderr } = await execFileP('openclaw', args, {
      timeout: 300000, // 5 min for agent responses
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
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Cron ──
app.get('/api/cron', async (req, res) => {
  try {
    const raw = await oc('cron', 'list', '--json')
    res.json(JSON.parse(raw))
  } catch (err) {
    res.json({ jobs: [], error: err.message })
  }
})

app.post('/api/cron', async (req, res) => {
  try {
    const { name, schedule, message, tz } = req.body
    const args = ['cron', 'add', '--name', name, '--cron', schedule, '--message', message]
    if (tz) args.push('--tz', tz)
    args.push('--json')
    const raw = await oc(...args)
    res.json(JSON.parse(raw).catch?.() || { ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/cron/:id/enable', async (req, res) => {
  try {
    await oc('cron', 'enable', req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/cron/:id/disable', async (req, res) => {
  try {
    await oc('cron', 'disable', req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/cron/:id/run', async (req, res) => {
  try {
    await oc('cron', 'run', req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/cron/:id', async (req, res) => {
  try {
    await oc('cron', 'rm', req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Reminders ──
app.get('/api/reminders/lists', async (req, res) => {
  try {
    const raw = await run('remindctl list')
    const lists = raw.split('\n')
      .map(l => l.replace(/\s*—\s*\d+\s*reminders?$/, '').trim())
      .filter(Boolean)
    res.json({ lists })
  } catch (err) {
    res.json({ lists: [], error: err.message })
  }
})

app.get('/api/reminders', async (req, res) => {
  try {
    const args = ['remindctl', 'show', '--json']
    if (req.query.list) args.splice(2, 0, '--list', req.query.list)
    const raw = await run(args.join(' '))
    let reminders
    try { reminders = JSON.parse(raw) } catch { reminders = [] }
    res.json({ reminders })
  } catch (err) {
    res.json({ reminders: [], error: err.message })
  }
})

app.post('/api/reminders', async (req, res) => {
  try {
    const { title, list, dueDate } = req.body
    let cmd = `remindctl add "${title.replace(/"/g, '\\"')}"`
    if (list) cmd += ` --list "${list.replace(/"/g, '\\"')}"`
    if (dueDate) cmd += ` --due "${dueDate}"`
    await run(cmd)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/reminders/:id/complete', async (req, res) => {
  try {
    await run(`remindctl complete "${req.params.id.replace(/"/g, '\\"')}"`)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Usage ──
app.get('/api/usage', async (req, res) => {
  try {
    const raw = await oc('status')
    // Try to parse session/token info from status output
    res.json({
      raw,
      totalInputTokens: null,
      totalOutputTokens: null,
      totalCost: null,
      byModel: {}
    })
  } catch (err) {
    res.json({ raw: '', error: err.message })
  }
})

// ── Sessions ──
app.get('/api/sessions', async (req, res) => {
  try {
    const raw = await oc('agents', 'list', '--json')
    let sessions
    try { sessions = JSON.parse(raw) } catch { sessions = [] }
    res.json({ sessions })
  } catch (err) {
    res.json({ sessions: [], error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`OpenClaw UI server running on http://localhost:${PORT}`)
})
