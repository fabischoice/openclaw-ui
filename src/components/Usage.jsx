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
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold">📊 Usage & Cost</h2>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
        >
          Refrescar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500">Cargando...</div>
        ) : (
          <>
            {/* Summary cards */}
            {usage && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <p className="text-xs text-gray-500 mb-1">Tokens (input)</p>
                  <p className="text-2xl font-bold text-blue-400">{fmtNum(usage.totalInputTokens)}</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <p className="text-xs text-gray-500 mb-1">Tokens (output)</p>
                  <p className="text-2xl font-bold text-green-400">{fmtNum(usage.totalOutputTokens)}</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <p className="text-xs text-gray-500 mb-1">Costo estimado</p>
                  <p className="text-2xl font-bold text-yellow-400">{fmtCost(usage.totalCost)}</p>
                </div>
              </div>
            )}

            {/* Per-model breakdown */}
            {usage?.byModel && Object.keys(usage.byModel).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Por modelo</h3>
                <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
                  {Object.entries(usage.byModel).map(([model, data]) => (
                    <div key={model} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{model}</p>
                        <p className="text-xs text-gray-500">{fmtNum(data.inputTokens)} in · {fmtNum(data.outputTokens)} out</p>
                      </div>
                      <p className="text-sm text-yellow-400 font-mono">{fmtCost(data.cost)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions */}
            {sessions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Sesiones activas</h3>
                <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
                  {sessions.map((s, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{s.agent || 'main'}</p>
                        <span className="text-xs text-gray-500">{s.model || '—'}</span>
                      </div>
                      {s.lastActivity && (
                        <p className="text-xs text-gray-500 mt-0.5">
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
                <h3 className="text-sm font-medium text-gray-400 mb-3">Estado completo</h3>
                <pre className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
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
