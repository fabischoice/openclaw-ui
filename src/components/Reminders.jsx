import { useState, useEffect } from 'react'

export default function Reminders() {
  const [lists, setLists] = useState([])
  const [reminders, setReminders] = useState([])
  const [selectedList, setSelectedList] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', list: '', dueDate: '' })

  const loadLists = async () => {
    try {
      const res = await fetch('/api/reminders/lists')
      const data = await res.json()
      setLists(data.lists || [])
    } catch {}
  }

  const loadReminders = async (list) => {
    setLoading(true)
    try {
      const q = list ? `?list=${encodeURIComponent(list)}` : ''
      const res = await fetch(`/api/reminders${q}`)
      const data = await res.json()
      setReminders(data.reminders || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadLists() }, [])
  useEffect(() => { loadReminders(selectedList) }, [selectedList])

  const complete = async (id) => {
    await fetch(`/api/reminders/${encodeURIComponent(id)}/complete`, { method: 'POST' })
    loadReminders(selectedList)
  }

  const addReminder = async () => {
    await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    setShowAdd(false)
    setForm({ title: '', list: '', dueDate: '' })
    loadReminders(selectedList)
  }

  const fmtDate = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('es-PR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">📝 Reminders</h2>
          <select
            value={selectedList}
            onChange={e => setSelectedList(e.target.value)}
            className="bg-gray-800 text-sm rounded px-2 py-1 border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todas</option>
            {lists.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          {showAdd ? 'Cancelar' : '+ Nueva'}
        </button>
      </div>

      {showAdd && (
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 space-y-3">
          <input
            placeholder="Título del recordatorio"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full bg-gray-800 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.list}
              onChange={e => setForm({ ...form, list: e.target.value })}
              className="bg-gray-800 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Lista por defecto</option>
              {lists.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={e => setForm({ ...form, dueDate: e.target.value })}
              className="bg-gray-800 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={addReminder}
            disabled={!form.title}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Crear recordatorio
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500">Cargando...</div>
        ) : reminders.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">No hay recordatorios pendientes</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {reminders.map((r, i) => (
              <div key={r.id || i} className="px-6 py-3 flex items-center gap-3 hover:bg-gray-900/30">
                <button
                  onClick={() => complete(r.id || r.title)}
                  className="w-5 h-5 rounded-full border-2 border-gray-600 hover:border-green-500 hover:bg-green-500/20 flex-shrink-0 transition-colors"
                  title="Marcar completo"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{r.title}</p>
                  <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                    {r.list && <span>{r.list}</span>}
                    {r.dueDate && <span>{fmtDate(r.dueDate)}</span>}
                    {r.priority && r.priority > 0 && <span className="text-yellow-400">Prioridad {r.priority}</span>}
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
