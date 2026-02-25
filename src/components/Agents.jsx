import { useState, useEffect } from 'react'

export default function Agents() {
  const [agents, setAgents] = useState([])
  const [subagents, setSubagents] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('agents')
  const [steerTarget, setSteerTarget] = useState(null)
  const [steerMsg, setSteerMsg] = useState('')
  const [confirmKill, setConfirmKill] = useState(null)

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

  const killSubagent = async (target) => {
    await fetch(`/api/subagents/${encodeURIComponent(target)}/kill`, { method: 'POST' })
    setConfirmKill(null)
    load()
  }

  const steer = async (target) => {
    if (!steerMsg.trim()) return
    await fetch(`/api/subagents/${encodeURIComponent(target)}/steer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: steerMsg })
    })
    setSteerTarget(null)
    setSteerMsg('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-white">
        <h2 className="text-lg font-bold text-blue-700">🤖 Agents</h2>
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
              {t === 'subagents' && subagents.length > 0 && (
                <span className="ml-1.5 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{subagents.length}</span>
              )}
            </button>
          ))}
          <button
            onClick={load}
            className="ml-2 text-sm px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 font-medium transition-colors"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-blue-300">Cargando...</div>
        ) : activeTab === 'agents' ? (
          /* ── Agents ── */
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
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">default</span>
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
                      <p className="text-gray-400 font-medium mb-1">Workspace</p>
                      <p className="text-gray-600 truncate font-mono">{agent.workspace || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-400 font-medium mb-1">Routing</p>
                      <p className="text-gray-600 truncate">{agent.routes?.join(', ') || 'No routes'}</p>
                    </div>
                  </div>

                  {agent.bindings > 0 && (
                    <p className="text-xs text-blue-400 mt-2">📌 {agent.bindings} binding(s)</p>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          /* ── Sub-agents ── */
          subagents.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-blue-300">
              <div className="text-center">
                <p className="text-3xl mb-2">🔀</p>
                <p>No hay sub-agents activos</p>
                <p className="text-sm mt-1 text-blue-200">Los sub-agents aparecen cuando se crean tareas en segundo plano</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {subagents.map((sa, i) => (
                <div key={sa.sessionKey || i} className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${sa.status === 'running' ? 'bg-green-400 animate-pulse' : sa.status === 'done' ? 'bg-blue-400' : 'bg-gray-300'}`} />
                        <h3 className="font-bold text-gray-800 text-sm">{sa.label || sa.sessionKey || `Sub-agent ${i + 1}`}</h3>
                      </div>
                      {sa.task && (
                        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{sa.task}</p>
                      )}
                      <div className="flex gap-3 mt-2 text-xs text-gray-400">
                        {sa.model && <span className="bg-blue-50 text-blue-400 px-2 py-0.5 rounded-md font-medium">{sa.model}</span>}
                        {sa.status && <span className="font-medium capitalize">{sa.status}</span>}
                        {sa.agentId && <span>Agent: {sa.agentId}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-3">
                      {sa.status === 'running' && (
                        <>
                          <button
                            onClick={() => setSteerTarget(steerTarget === sa.sessionKey ? null : sa.sessionKey)}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 font-medium transition-colors"
                          >
                            💬 Steer
                          </button>
                          {confirmKill === sa.sessionKey ? (
                            <div className="flex gap-1">
                              <button onClick={() => killSubagent(sa.sessionKey)} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500 text-white font-medium">Sí</button>
                              <button onClick={() => setConfirmKill(null)} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 font-medium">No</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmKill(sa.sessionKey)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-400 transition-colors font-medium"
                            >
                              ⏹ Kill
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Steer input */}
                  {steerTarget === sa.sessionKey && (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={steerMsg}
                        onChange={e => setSteerMsg(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && steer(sa.sessionKey)}
                        placeholder="Enviar instrucción al sub-agent..."
                        className="flex-1 bg-blue-50/50 text-sm rounded-xl px-4 py-2 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        autoFocus
                      />
                      <button
                        onClick={() => steer(sa.sessionKey)}
                        disabled={!steerMsg.trim()}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 text-white text-sm px-4 py-2 rounded-xl font-semibold transition-all"
                      >
                        Enviar
                      </button>
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
