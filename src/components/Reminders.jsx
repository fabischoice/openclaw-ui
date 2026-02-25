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
      <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-blue-700">📝 Reminders</h2>
          <select
            value={selectedList}
            onChange={e => setSelectedList(e.target.value)}
            className="bg-blue-50 text-sm rounded-lg px-3 py-1.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 text-blue-600 font-medium"
          >
            <option value="">Todas</option>
            {lists.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className={`text-sm px-4 py-2 rounded-xl font-semibold transition-all duration-200 ${
            showAdd
              ? 'bg-gray-100 text-gray-500'
              : 'bg-blue-500 text-white shadow-md shadow-blue-200 hover:bg-blue-600'
          }`}
        >
          {showAdd ? 'Cancelar' : '+ Nueva'}
        </button>
      </div>

      {showAdd && (
        <div className="px-6 py-5 border-b border-blue-100 bg-blue-50/50 space-y-3">
          <input
            placeholder="Título del recordatorio"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full bg-white text-sm rounded-xl px-4 py-2.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.list}
              onChange={e => setForm({ ...form, list: e.target.value })}
              className="bg-white text-sm rounded-xl px-4 py-2.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
              className="bg-white text-sm rounded-xl px-4 py-2.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            onClick={addReminder}
            disabled={!form.title}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 text-white text-sm px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md shadow-blue-200"
          >
            ✨ Crear recordatorio
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-blue-300">Cargando...</div>
        ) : reminders.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-blue-300">
            <div className="text-center">
              <p className="text-3xl mb-2">✨</p>
              <p>No hay recordatorios pendientes</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {reminders.map((r, i) => (
              <div key={r.id || i} className="bg-white rounded-2xl border border-blue-100 px-4 py-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <button
                  onClick={() => complete(r.id || r.title)}
                  className="w-5 h-5 rounded-full border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 flex-shrink-0 transition-all"
                  title="Marcar completo"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{r.title}</p>
                  <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                    {r.list && <span className="text-blue-400">{r.list}</span>}
                    {r.dueDate && <span>{fmtDate(r.dueDate)}</span>}
                    {r.priority && r.priority > 0 && <span className="text-amber-400">★ Prioridad {r.priority}</span>}
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
