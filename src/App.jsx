import { useState, useEffect } from 'react'
import Chat from './components/Chat.jsx'
import CronJobs from './components/CronJobs.jsx'
import Reminders from './components/Reminders.jsx'
import Usage from './components/Usage.jsx'
import Agents from './components/Agents.jsx'

const TABS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'agents', label: 'Agents', icon: '🤖' },
  { id: 'cron', label: 'Cron Jobs', icon: '⏰' },
  { id: 'reminders', label: 'Reminders', icon: '📝' },
  { id: 'usage', label: 'Usage', icon: '📊' },
]

function GatewayControls() {
  const [status, setStatus] = useState('unknown') // unknown | running | stopped
  const [loading, setLoading] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const checkStatus = () => {
    fetch('/api/gateway/status').then(r => r.json()).then(d => {
      setStatus(d.running ? 'running' : 'stopped')
    }).catch(() => setStatus('unknown'))
  }

  useEffect(() => {
    checkStatus()
    const iv = setInterval(checkStatus, 10000)
    return () => clearInterval(iv)
  }, [])

  const action = async (cmd) => {
    setLoading(true)
    try {
      const res = await fetch('/api/gateway/' + cmd, { method: 'POST' })
      const d = await res.json()
      if (d.error) showToast(d.error, 'error')
      else showToast(`Gateway ${cmd === 'start' ? 'iniciado' : cmd === 'stop' ? 'detenido' : 'reiniciado'} ✓`)
      setTimeout(checkStatus, 1500)
    } catch (err) {
      showToast(err.message, 'error')
    }
    setLoading(false)
    setConfirmStop(false)
  }

  return (
    <div className="p-4 border-t border-blue-100 relative">
      {toast && (
        <div className={`absolute bottom-full mb-2 left-3 right-3 px-3 py-2 rounded-xl text-xs font-medium text-center shadow-lg ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${
            status === 'running' ? 'bg-green-400 animate-pulse' :
            status === 'stopped' ? 'bg-red-400' : 'bg-gray-300'
          }`} />
          <span className="text-xs text-gray-400">
            Gateway {status === 'running' ? 'activo' : status === 'stopped' ? 'detenido' : '...'}
          </span>
        </div>
      </div>

      {confirmStop ? (
        <div className="space-y-1.5">
          <p className="text-xs text-red-500 font-medium text-center">¿Detener el gateway?</p>
          <div className="flex gap-1.5">
            <button onClick={() => action('stop')} disabled={loading}
              className="flex-1 py-1.5 text-xs rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors">
              {loading ? '...' : 'Sí, detener'}
            </button>
            <button onClick={() => setConfirmStop(false)}
              className="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          {status !== 'running' ? (
            <button onClick={() => action('start')} disabled={loading}
              className="flex-1 py-1.5 text-xs rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors shadow-sm">
              {loading ? '...' : '▶ Iniciar'}
            </button>
          ) : (
            <button onClick={() => setConfirmStop(true)} disabled={loading}
              className="flex-1 py-1.5 text-xs rounded-lg bg-red-50 text-red-400 font-semibold hover:bg-red-100 border border-red-100 transition-colors">
              ⏹ Detener
            </button>
          )}
          <button onClick={() => action('restart')} disabled={loading}
            className="flex-1 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-500 font-semibold hover:bg-blue-100 border border-blue-100 transition-colors">
            {loading ? '...' : '🔄 Restart'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('chat')
  const [status, setStatus] = useState(null)

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {})
  }, [])

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="w-56 bg-gradient-to-b from-blue-50 to-white border-r border-blue-100 flex flex-col">
        <div className="p-5 border-b border-blue-100">
          <h1 className="text-lg font-bold flex items-center gap-2 text-blue-700">
            🦞 <span>OpenClaw</span>
          </h1>
          {status && (
            <p className="text-xs text-blue-300 mt-1 font-medium">v{status.version || '?'}</p>
          )}
        </div>
        <div className="flex-1 p-3 space-y-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                tab === t.id
                  ? 'bg-blue-500 text-white font-semibold shadow-md shadow-blue-200'
                  : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
              }`}
            >
              <span className="mr-2">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <GatewayControls />
      </nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
        {tab === 'chat' && <Chat />}
        {tab === 'agents' && <Agents />}
        {tab === 'cron' && <CronJobs />}
        {tab === 'reminders' && <Reminders />}
        {tab === 'usage' && <Usage />}
      </main>
    </div>
  )
}
