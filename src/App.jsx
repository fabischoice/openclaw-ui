import { useState, useEffect } from 'react'
import Chat from './components/Chat.jsx'
import CronJobs from './components/CronJobs.jsx'
import Reminders from './components/Reminders.jsx'
import Usage from './components/Usage.jsx'
import Agents from './components/Agents.jsx'

const TABS = [
  { id: 'chat',      label: 'Chat',       icon: '💬' },
  { id: 'agents',    label: 'Agents',     icon: '🤖' },
  { id: 'cron',      label: 'Cron Jobs',  icon: '⏰' },
  { id: 'reminders', label: 'Reminders',  icon: '📝' },
  { id: 'usage',     label: 'Usage',      icon: '📊' },
]

function GatewayControls() {
  const [status, setStatus]       = useState('unknown')
  const [loading, setLoading]     = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [toast, setToast]         = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const checkStatus = () => {
    fetch('/api/gateway/status')
      .then(r => r.json())
      .then(d => setStatus(d.running ? 'running' : 'stopped'))
      .catch(() => setStatus('unknown'))
  }

  useEffect(() => { checkStatus(); const iv = setInterval(checkStatus, 10000); return () => clearInterval(iv) }, [])

  const action = async (cmd) => {
    setLoading(true)
    try {
      const res = await fetch('/api/gateway/' + cmd, { method: 'POST' })
      const d = await res.json()
      if (d.error) showToast(d.error, 'error')
      else showToast(cmd === 'start' ? 'Gateway iniciado ✓' : cmd === 'stop' ? 'Gateway detenido ✓' : 'Gateway reiniciado ✓')
      setTimeout(checkStatus, 1500)
    } catch (err) { showToast(err.message, 'error') }
    setLoading(false)
    setConfirmStop(false)
  }

  const dot = status === 'running' ? 'bg-green-400 animate-pulse' : status === 'stopped' ? 'bg-red-400' : 'bg-gray-300'
  const label = status === 'running' ? 'Activo' : status === 'stopped' ? 'Detenido' : '...'

  return (
    <div className="px-4 pb-4 relative">
      {toast && (
        <div className={`absolute bottom-full mb-2 left-3 right-3 px-3 py-2 rounded-xl text-xs font-semibold text-center shadow-lg z-10 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
      <div className="rounded-2xl border border-blue-100 bg-white p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
          <span className="text-xs font-semibold text-gray-500">Gateway · {label}</span>
        </div>
        {confirmStop ? (
          <div className="space-y-2">
            <p className="text-xs text-red-500 font-semibold text-center">¿Segura que quieres detenerlo?</p>
            <div className="flex gap-2">
              <button onClick={() => action('stop')} disabled={loading}
                className="flex-1 py-2 text-xs rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors">
                {loading ? '...' : 'Sí, detener'}
              </button>
              <button onClick={() => setConfirmStop(false)}
                className="flex-1 py-2 text-xs rounded-xl bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {status !== 'running' ? (
              <button onClick={() => action('start')} disabled={loading}
                className="flex-1 py-2 text-xs rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-colors">
                {loading ? '...' : '▶ Iniciar'}
              </button>
            ) : (
              <button onClick={() => setConfirmStop(true)} disabled={loading}
                className="flex-1 py-2 text-xs rounded-xl bg-red-50 text-red-500 font-bold hover:bg-red-100 border border-red-100 transition-colors">
                ⏹ Detener
              </button>
            )}
            <button onClick={() => action('restart')} disabled={loading}
              className="flex-1 py-2 text-xs rounded-xl bg-blue-50 text-blue-500 font-bold hover:bg-blue-100 border border-blue-100 transition-colors">
              {loading ? '...' : '↺ Restart'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab]     = useState('chat')
  const [status, setStatus] = useState(null)

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {})
  }, [])

  return (
    <div className="flex h-screen bg-slate-50">
      {/* ── Sidebar ── */}
      <nav className="w-60 bg-white border-r border-blue-100 flex flex-col shadow-sm">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-blue-50">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🦞</span>
            <div>
              <h1 className="text-base font-bold text-blue-700 leading-none">OpenClaw</h1>
              {status && <p className="text-[11px] text-blue-300 mt-0.5">v{status.version || '?'}</p>}
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 p-3 space-y-1 overflow-y-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center gap-3 ${
                tab === t.id
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Gateway */}
        <GatewayControls />
      </nav>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {tab === 'chat'      && <Chat />}
        {tab === 'agents'    && <Agents />}
        {tab === 'cron'      && <CronJobs />}
        {tab === 'reminders' && <Reminders />}
        {tab === 'usage'     && <Usage />}
      </main>
    </div>
  )
}
