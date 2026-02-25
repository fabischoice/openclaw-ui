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

  const relTime = (ms) => {
    if (!ms) return '—'
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-white">
        <h2 className="text-lg font-bold text-blue-700">⏰ Cron Jobs</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className={`text-sm px-4 py-2 rounded-xl font-semibold transition-all duration-200 ${
            showAdd
              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              : 'bg-blue-500 text-white shadow-md shadow-blue-200 hover:bg-blue-600'
          }`}
        >
          {showAdd ? 'Cancelar' : '+ Nuevo'}
        </button>
      </div>

      {showAdd && (
        <div className="px-6 py-5 border-b border-blue-100 bg-blue-50/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Nombre"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="bg-white text-sm rounded-xl px-4 py-2.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <input
              placeholder="Schedule (e.g. 0 9 * * *)"
              value={form.schedule}
              onChange={e => setForm({ ...form, schedule: e.target.value })}
              className="bg-white text-sm rounded-xl px-4 py-2.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>
          <textarea
            placeholder="Mensaje para el agente"
            value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
            rows={2}
            className="w-full bg-white text-sm rounded-xl px-4 py-2.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
          />
          <button
            onClick={addJob}
            disabled={!form.name || !form.schedule || !form.message}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 text-white text-sm px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-blue-200"
          >
            ✨ Crear cron job
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-blue-300">Cargando...</div>
        ) : jobs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-blue-300">
            <div className="text-center">
              <p className="text-3xl mb-2">⏰</p>
              <p>No hay cron jobs</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${job.enabled ? (job.state?.lastStatus === 'error' ? 'bg-red-400' : 'bg-green-400') : 'bg-gray-300'}`} />
                      <h3 className="font-semibold text-sm text-gray-800">{job.name}</h3>
                      <span className="text-xs text-blue-400 font-mono bg-blue-50 px-2 py-0.5 rounded-md">{job.schedule?.expr}</span>
                    </div>
                    {job.description && (
                      <p className="text-xs text-gray-400 mt-1.5 truncate">{job.description}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span>⏭ {relTime(job.state?.nextRunAtMs)}</span>
                      <span>⏮ {relTime(job.state?.lastRunAtMs)}</span>
                      {job.state?.lastStatus && (
                        <span className={`font-medium ${job.state.lastStatus === 'error' ? 'text-red-400' : 'text-green-500'}`}>
                          {job.state.lastStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3">
                    <button
                      onClick={() => runJob(job.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 font-medium transition-colors"
                      title="Run now"
                    >▶</button>
                    <button
                      onClick={() => toggleJob(job.id, job.enabled)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        job.enabled
                          ? 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                          : 'bg-green-50 text-green-500 hover:bg-green-100'
                      }`}
                    >
                      {job.enabled ? 'Pausar' : 'Activar'}
                    </button>
                    {confirmDelete === job.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteJob(job.id)} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500 text-white font-medium">Sí</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 font-medium">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(job.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-400 transition-colors"
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
