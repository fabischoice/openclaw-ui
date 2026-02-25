import { useState, useEffect } from 'react'

export default function CronJobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', schedule: '', message: '', tz: 'America/Puerto_Rico' })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = () => {
    setLoading(true)
    fetch('/api/cron').then(r => r.json()).then(data => {
      setJobs(data.jobs || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(load, [])

  const toggleJob = async (id, enabled) => {
    await fetch(`/api/cron/${id}/${enabled ? 'disable' : 'enable'}`, { method: 'POST' })
    load()
  }

  const deleteJob = async (id) => {
    await fetch(`/api/cron/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    load()
  }

  const addJob = async () => {
    await fetch('/api/cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    setShowAdd(false)
    setForm({ name: '', schedule: '', message: '', tz: 'America/Puerto_Rico' })
    load()
  }

  const runJob = async (id) => {
    await fetch(`/api/cron/${id}/run`, { method: 'POST' })
  }

  const fmtTime = (ms) => {
    if (!ms) return '—'
    const d = new Date(ms)
    return d.toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' })
  }

  const relTime = (ms) => {
    if (!ms) return ''
    const diff = ms - Date.now()
    if (Math.abs(diff) < 60000) return 'ahora'
    const mins = Math.round(diff / 60000)
    if (Math.abs(mins) < 60) return diff > 0 ? `en ${mins}m` : `hace ${-mins}m`
    const hrs = Math.round(mins / 60)
    if (Math.abs(hrs) < 24) return diff > 0 ? `en ${hrs}h` : `hace ${-hrs}h`
    const days = Math.round(hrs / 24)
    return diff > 0 ? `en ${days}d` : `hace ${-days}d`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold">⏰ Cron Jobs</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          {showAdd ? 'Cancelar' : '+ Nuevo'}
        </button>
      </div>

      {showAdd && (
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Nombre"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="bg-gray-800 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
            <input
              placeholder="Schedule (e.g. 0 9 * * *)"
              value={form.schedule}
              onChange={e => setForm({ ...form, schedule: e.target.value })}
              className="bg-gray-800 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <textarea
            placeholder="Mensaje para el agente"
            value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
            rows={2}
            className="w-full bg-gray-800 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
          />
          <button
            onClick={addJob}
            disabled={!form.name || !form.schedule || !form.message}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Crear cron job
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500">Cargando...</div>
        ) : jobs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">No hay cron jobs</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {jobs.map(job => (
              <div key={job.id} className="px-6 py-4 hover:bg-gray-900/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${job.enabled ? (job.state?.lastStatus === 'error' ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-600'}`} />
                      <h3 className="font-medium text-sm">{job.name}</h3>
                      <span className="text-xs text-gray-500 font-mono">{job.schedule?.expr}</span>
                    </div>
                    {job.description && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{job.description}</p>
                    )}
                    <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                      <span>Próx: {relTime(job.state?.nextRunAtMs)}</span>
                      <span>Últ: {relTime(job.state?.lastRunAtMs)}</span>
                      {job.state?.lastStatus && (
                        <span className={job.state.lastStatus === 'error' ? 'text-red-400' : 'text-green-400'}>
                          {job.state.lastStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => runJob(job.id)}
                      className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
                      title="Run now"
                    >▶</button>
                    <button
                      onClick={() => toggleJob(job.id, job.enabled)}
                      className={`text-xs px-2 py-1 rounded ${job.enabled ? 'bg-yellow-900/50 text-yellow-400 hover:bg-yellow-900' : 'bg-green-900/50 text-green-400 hover:bg-green-900'}`}
                    >
                      {job.enabled ? 'Pausar' : 'Activar'}
                    </button>
                    {confirmDelete === job.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteJob(job.id)} className="text-xs px-2 py-1 rounded bg-red-600 text-white">Sí, borrar</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(job.id)}
                        className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400"
                      >🗑</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
