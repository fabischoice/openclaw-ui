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
        <div className="p-4 border-t border-blue-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-xs text-gray-400">Gateway connected</span>
          </div>
        </div>
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
