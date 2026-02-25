import { useState, useEffect } from 'react'
import Chat from './components/Chat.jsx'
import CronJobs from './components/CronJobs.jsx'
import Reminders from './components/Reminders.jsx'
import Usage from './components/Usage.jsx'

const TABS = [
  { id: 'chat', label: '💬 Chat', icon: '💬' },
  { id: 'cron', label: '⏰ Cron', icon: '⏰' },
  { id: 'reminders', label: '📝 Reminders', icon: '📝' },
  { id: 'usage', label: '📊 Usage', icon: '📊' },
]

export default function App() {
  const [tab, setTab] = useState('chat')
  const [status, setStatus] = useState(null)

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {})
  }, [])

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold flex items-center gap-2">
            🦞 <span>OpenClaw</span>
          </h1>
          {status && (
            <p className="text-xs text-gray-500 mt-1">v{status.version || '?'}</p>
          )}
        </div>
        <div className="flex-1 p-2 space-y-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                tab === t.id
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-800 text-xs text-gray-600">
          {status?.gateway || 'Connecting...'}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {tab === 'chat' && <Chat />}
        {tab === 'cron' && <CronJobs />}
        {tab === 'reminders' && <Reminders />}
        {tab === 'usage' && <Usage />}
      </main>
    </div>
  )
}
