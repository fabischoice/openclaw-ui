import { useState, useEffect } from 'react'

const MAX_AGENTS = 8

export default function Agents() {
  const [agents, setAgents] = useState([])
  const [subagents, setSubagents] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('agents')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '🤖', model: 'anthropic/claude-haiku-4-5', description: '' })
  const [steerTarget, setSteerTarget] = useState(null)
  const [steerMsg, setSteerMsg] = useState('')
  const [confirmKill, setConfirmKill] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const [aRes, sRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/subagents')
      ])
      setAgents((await aRes.json()).agents || [])
      setSubagents((await sRes.json()).subagents || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const createAgent = async () => {
    if (agents.length >= MAX_AGENTS) {
      showToast(`Máximo ${MAX_AGENTS} agents permitidos`, 'error')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.error) {
        showToast(data.error, 'error')
      } else {
        showToast(`Agent "${form.name}" creado ✨`)
        setShowCreate(false)
        setForm({ name: '', emoji: '🤖', model: 'anthropic/claude-haiku-4-5', description: '' })
        load()
      }
    } catch (err) {
      showToast(err.message, 'error')
    }
    setCreating(false)
  }

  const killSubagent = async (target) => {
    await fetch(`/api/subagents/${encodeURIComponent(target)}/kill`, { method: 'POST' })
    setConfirmKill(null)
    showToast('Sub-agent terminado')
    load()
  }

  const steer = async (target) => {
    if (!steerMsg.trim()) return
    await fetch(`/api/subagents/${encodeURIComponent(target)}/steer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: steerMsg })
    })
    showToast('Instrucción enviada')
    setSteerTarget(null)
    setSteerMsg('')
  }

  const MODEL_OPTIONS = [
    { id: 'anthropic/claude-haiku-4-5', label: 'Basic (Haiku)', desc: 'Rápido y económico' },
    { id: 'anthropic/claude-sonnet-4-6', label: 'Medium (Sonnet)', desc: 'Balanceado' },
    { id: 'anthropic/claude-opus-4-6', label: 'Hard (Opus)', desc: 'Máxima calidad' },
  ]

  return (
    <div className="flex flex-col h-full relative">
      {/* Toast */}
      {toast && (
        <div className={`absolute top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-fade-in ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-white">
        <h2 className="text-lg font-bold text-blue-700">🤖 Agents</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {['agents', 'subagents'].map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all duration-200 ${
                  activeTab === t
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                    : 'bg-blue-50 text-blue-400 hover:bg-blue-100'
                }`}
              >
                {t === 'agents' ? '🤖 Agents' : '🔀 Sub-agents'}
              </button>
            ))}
          </div>
          {activeTab === 'agents' && (
            <button
              onClick={() => setShowCreate(true)}
              disabled={agents.length >= MAX_AGENTS}
              className="ml-2 text-sm px-4 py-1.5 rounded-xl bg-blue-500 text-white font-semibold shadow-md shadow-blue-200 hover:bg-blue-600 disabled:bg-blue-200 disabled:text-blue-100 transition-all"
            >
              + Crear Agent
            </button>
          )}
          <button
            onClick={load}
            className="text-sm px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 font-medium transition-colors"
          >🔄</button>
        </div>
      </div>

      {/* Agent count indicator */}
      {activeTab === 'agents' && (
        <div className="px-6 py-2 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
          <span className="text-xs text-blue-400">{agents.length} de {MAX_AGENTS} agents</span>
          <div className="flex gap-1">
            {Array.from({ length: MAX_AGENTS }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < agents.length ? 'bg-blue-400' : 'bg-blue-100'}`} />
            ))}
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 border border-blue-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-blue-700">✨ Crear nuevo Agent</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-20">
                  <label className="text-xs text-blue-400 font-medium block mb-1">Emoji</label>
                  <input
                    value={form.emoji}
                    onChange={e => setForm({ ...form, emoji: e.target.value })}
                    className="w-full bg-blue-50 text-center text-2xl rounded-xl px-2 py-2.5 border border-blue-200 focus:border-blue-400 focus:outline-none"
                    maxLength={4}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-blue-400 font-medium block mb-1">Nombre</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="ej: Research Assistant"
                    className="w-full bg-blue-50 text-sm rounded-xl px-4 py-2.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-blue-400 font-medium block mb-1">Modelo</label>
                <div className="space-y-2">
                  {MODEL_OPTIONS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setForm({ ...form, model: m.id })}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        form.model === m.id
                          ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100'
                          : 'border-blue-100 bg-white hover:bg-blue-50/50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-700">{m.label}</p>
                      <p className="text-xs text-gray-400">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-blue-400 font-medium block mb-1">Descripción (opcional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="¿Para qué es este agent?"
                  rows={2}
                  className="w-full bg-blue-50 text-sm rounded-xl px-4 py-2.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createAgent}
                disabled={!form.name.trim() || creating}
                className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-semibold shadow-md shadow-blue-200 hover:bg-blue-600 disabled:bg-blue-200 transition-all"
              >
                {creating ? '✨ Creando...' : '✨ Crear Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-blue-300">Cargando...</div>
        ) : activeTab === 'agents' ? (
          agents.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-blue-300">
              <div className="text-center">
                <p className="text-3xl mb-2">🤖</p>
                <p>No hay agents configurados</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map(agent => (
                <div key={agent.id} className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{agent.identityEmoji || '🤖'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-800">{agent.identityName || agent.id}</h3>
                          {agent.isDefault && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">principal</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{agent.id}</p>
                      </div>
                    </div>
                    <span className="text-xs text-blue-400 bg-blue-50 px-2.5 py-1 rounded-lg font-medium">
                      {agent.model?.split('/')?.pop() || '—'}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-400 font-medium mb-1">📁 Workspace</p>
                      <p className="text-gray-600 truncate font-mono">{agent.workspace || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-400 font-medium mb-1">🔗 Routing</p>
                      <p className="text-gray-600 truncate">{agent.routes?.join(', ') || 'Default'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Sub-agents */
          subagents.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-blue-300">
              <div className="text-center">
                <p className="text-3xl mb-2">🔀</p>
                <p>No hay sub-agents activos</p>
                <p className="text-sm mt-1 text-blue-200">Aparecen cuando se crean tareas en segundo plano</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {subagents.map((sa, i) => (
                <div key={sa.sessionKey || i} className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${sa.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`} />
                        <h3 className="font-bold text-gray-800 text-sm">{sa.label || sa.sessionKey || `Sub-agent ${i + 1}`}</h3>
                      </div>
                      {sa.task && <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{sa.task}</p>}
                      <div className="flex gap-2 mt-2 text-xs">
                        {sa.model && <span className="bg-blue-50 text-blue-400 px-2 py-0.5 rounded-md font-medium">{sa.model}</span>}
                        {sa.status && <span className="capitalize text-gray-400">{sa.status}</span>}
                      </div>
                    </div>
                    {sa.status === 'running' && (
                      <div className="flex items-center gap-1.5 ml-3">
                        <button
                          onClick={() => setSteerTarget(steerTarget === sa.sessionKey ? null : sa.sessionKey)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 font-medium"
                        >💬</button>
                        {confirmKill === sa.sessionKey ? (
                          <div className="flex gap-1">
                            <button onClick={() => killSubagent(sa.sessionKey)} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500 text-white font-medium">Sí</button>
                            <button onClick={() => setConfirmKill(null)} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmKill(sa.sessionKey)} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-400">⏹</button>
                        )}
                      </div>
                    )}
                  </div>
                  {steerTarget === sa.sessionKey && (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={steerMsg}
                        onChange={e => setSteerMsg(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && steer(sa.sessionKey)}
                        placeholder="Instrucción..."
                        className="flex-1 bg-blue-50/50 text-sm rounded-xl px-4 py-2 border border-blue-200 focus:border-blue-400 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => steer(sa.sessionKey)} disabled={!steerMsg.trim()} className="bg-blue-500 text-white text-sm px-4 py-2 rounded-xl font-semibold">Enviar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
