import { useState, useEffect } from 'react'

export default function Usage() {
  const [usage, setUsage] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [uRes, sRes] = await Promise.all([
        fetch('/api/usage'),
        fetch('/api/sessions')
      ])
      setUsage(await uRes.json())
      setSessions((await sRes.json()).sessions || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const fmtNum = (n) => {
    if (!n) return '0'
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return String(n)
  }

  const fmtCost = (c) => {
    if (!c && c !== 0) return '—'
    return `$${Number(c).toFixed(4)}`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-white">
        <h2 className="text-lg font-bold text-blue-700">📊 Usage & Cost</h2>
        <button
          onClick={load}
          className="text-sm px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-500 font-semibold transition-colors"
        >
          🔄 Refrescar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-blue-300">Cargando...</div>
        ) : (
          <>
            {/* Summary cards */}
            {usage && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm">
                  <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-2">Tokens (input)</p>
                  <p className="text-2xl font-bold text-blue-600">{fmtNum(usage.totalInputTokens)}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm">
                  <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-2">Tokens (output)</p>
                  <p className="text-2xl font-bold text-blue-500">{fmtNum(usage.totalOutputTokens)}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm">
                  <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-2">Costo estimado</p>
                  <p className="text-2xl font-bold text-blue-700">{fmtCost(usage.totalCost)}</p>
                </div>
              </div>
            )}

            {/* Per-model breakdown */}
            {usage?.byModel && Object.keys(usage.byModel).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">Por modelo</h3>
                <div className="bg-white rounded-2xl border border-blue-100 shadow-sm divide-y divide-blue-50">
                  {Object.entries(usage.byModel).map(([model, data]) => (
                    <div key={model} className="px-5 py-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{model}</p>
                        <p className="text-xs text-gray-400">{fmtNum(data.inputTokens)} in · {fmtNum(data.outputTokens)} out</p>
                      </div>
                      <p className="text-sm text-blue-600 font-mono font-semibold">{fmtCost(data.cost)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions */}
            {sessions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">Sesiones activas</h3>
                <div className="bg-white rounded-2xl border border-blue-100 shadow-sm divide-y divide-blue-50">
                  {sessions.map((s, i) => (
                    <div key={i} className="px-5 py-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          <p className="text-sm font-semibold text-gray-700">{s.agent || 'main'}</p>
                        </div>
                        <span className="text-xs text-blue-400 bg-blue-50 px-2 py-0.5 rounded-md font-medium">{s.model || '—'}</span>
                      </div>
                      {s.lastActivity && (
                        <p className="text-xs text-gray-400 mt-1 ml-4">
                          Última actividad: {new Date(s.lastActivity).toLocaleString('es-PR')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw status */}
            {usage?.raw && (
              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">Estado completo</h3>
                <pre className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 text-xs text-gray-500 overflow-x-auto whitespace-pre-wrap font-mono">
                  {usage.raw}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
