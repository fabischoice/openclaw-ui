import { useState, useEffect } from 'react'

export default function Usage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusRaw, setStatusRaw] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/usage')
      const data = await res.json()
      setSessions(data.sessions || [])
      setStatusRaw(data.raw || '')
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const fmtTokens = (n) => {
    if (!n) return '0'
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return Math.round(n / 1000) + 'K'
    return String(n)
  }

  const pctColor = (pct) => {
    if (pct > 75) return 'bg-red-400'
    if (pct > 50) return 'bg-amber-400'
    return 'bg-blue-400'
  }

  // Parse sessions from status text
  const parseSessionsFromStatus = (raw) => {
    const lines = raw.split('\n')
    const sessions = []
    let inTable = false
    for (const line of lines) {
      if (line.includes('Key') && line.includes('Model') && line.includes('Tokens')) {
        inTable = true
        continue
      }
      if (inTable && line.includes('│')) {
        const cols = line.split('│').map(c => c.trim()).filter(Boolean)
        if (cols.length >= 4 && !cols[0].includes('─')) {
          const key = cols[0]
          const kind = cols[1]
          const age = cols[2]
          const model = cols[3]
          const tokenInfo = cols[4] || ''

          // Parse tokens like "51k/200k (25%)"
          const tokenMatch = tokenInfo.match(/([\d.]+[kKmM]?)\/([\d.]+[kKmM]?)\s*\((\d+)%\)/)
          let used = 0, total = 0, pct = 0
          if (tokenMatch) {
            used = parseTokenNum(tokenMatch[1])
            total = parseTokenNum(tokenMatch[2])
            pct = parseInt(tokenMatch[3])
          }

          const cached = tokenInfo.match(/(\d+)%\s*cached/)
          const cachedPct = cached ? parseInt(cached[1]) : 0

          sessions.push({ key, kind, age, model, used, total, pct, cachedPct })
        }
      }
      if (inTable && line.includes('└')) {
        inTable = false
      }
    }
    return sessions
  }

  const parseTokenNum = (s) => {
    if (!s) return 0
    s = s.toLowerCase()
    if (s.endsWith('k')) return parseFloat(s) * 1000
    if (s.endsWith('m')) return parseFloat(s) * 1000000
    return parseFloat(s)
  }

  const parsedSessions = statusRaw ? parseSessionsFromStatus(statusRaw) : []

  // Group by model
  const byModel = {}
  for (const s of parsedSessions) {
    if (!byModel[s.model]) byModel[s.model] = { sessions: 0, totalUsed: 0, totalCapacity: 0 }
    byModel[s.model].sessions++
    byModel[s.model].totalUsed += s.used
    byModel[s.model].totalCapacity += s.total
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-white">
        <h2 className="text-lg font-bold text-blue-700">📊 Uso de Tokens</h2>
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
            {/* Model summary cards */}
            {Object.keys(byModel).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">Resumen por modelo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(byModel).map(([model, data]) => {
                    const pct = data.totalCapacity > 0 ? Math.round(data.totalUsed / data.totalCapacity * 100) : 0
                    return (
                      <div key={model} className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-700">{model}</h4>
                          <span className="text-xs text-blue-400 bg-blue-50 px-2 py-0.5 rounded-md">
                            {data.sessions} sesión{data.sessions > 1 ? 'es' : ''}
                          </span>
                        </div>
                        <div className="flex items-end justify-between mb-2">
                          <span className="text-2xl font-bold text-blue-600">{fmtTokens(data.totalUsed)}</span>
                          <span className="text-sm text-gray-400">de {fmtTokens(data.totalCapacity)}</span>
                        </div>
                        <div className="w-full bg-blue-100 rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full transition-all ${pctColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">{pct}% del contexto usado</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Session details */}
            {parsedSessions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">Sesiones activas</h3>
                <div className="space-y-2">
                  {parsedSessions.map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          <span className="text-sm font-medium text-gray-700 truncate max-w-[250px]">{s.key}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{s.age}</span>
                          <span className="text-xs text-blue-400 bg-blue-50 px-2 py-0.5 rounded-md font-medium">{s.model}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="w-full bg-blue-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${pctColor(s.pct)}`} style={{ width: `${Math.min(s.pct, 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 font-mono w-24 text-right">
                          {fmtTokens(s.used)} / {fmtTokens(s.total)}
                        </span>
                        <span className="text-xs text-gray-400 w-10 text-right">{s.pct}%</span>
                      </div>
                      {s.cachedPct > 0 && (
                        <p className="text-xs text-green-500 mt-1">🗄️ {s.cachedPct}% cached</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If no sessions parsed, show raw */}
            {parsedSessions.length === 0 && statusRaw && (
              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">Estado del sistema</h3>
                <pre className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 text-xs text-gray-500 overflow-x-auto whitespace-pre-wrap font-mono">
                  {statusRaw}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
