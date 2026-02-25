import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const THINKING_MODES = ['off', 'low', 'medium', 'high']

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState([])
  const [currentModel, setCurrentModel] = useState('')
  const [thinking, setThinking] = useState('off')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(data => {
      setModels(data.models || [])
      setCurrentModel(data.current || '')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const switchModel = async (model) => {
    setCurrentModel(model)
    try {
      await fetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      })
    } catch {}
  }

  const switchThinking = async (level) => {
    setThinking(level)
    try {
      await fetch('/api/thinking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      })
    } catch {}
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model: currentModel, thinking })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'No response' }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-blue-100 bg-white flex-wrap">
        {/* Model selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-blue-400 font-medium uppercase tracking-wide">Model</label>
          <select
            value={currentModel}
            onChange={e => switchModel(e.target.value)}
            className="bg-blue-50 text-sm text-blue-700 rounded-lg px-3 py-1.5 border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 font-medium"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>
                {m.alias || m.id}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-blue-100"></div>

        {/* Thinking mode */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-blue-400 font-medium uppercase tracking-wide mr-1">Thinking</label>
          {THINKING_MODES.map(mode => (
            <button
              key={mode}
              onClick={() => switchThinking(mode)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
                thinking === mode
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                  : 'bg-blue-50 text-blue-400 hover:bg-blue-100 hover:text-blue-600 border border-blue-100'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-blue-300">
            <div className="text-center">
              <p className="text-5xl mb-4">🦞</p>
              <p className="text-lg font-medium">Envía un mensaje para comenzar</p>
              <p className="text-sm mt-1 text-blue-200">Tu asistente está lista ✨</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                : 'bg-white text-gray-700 border border-blue-100 shadow-sm'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="chat-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-blue-100 rounded-2xl px-4 py-3 text-blue-400 shadow-sm">
              <span className="animate-pulse">✨ Pensando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-blue-100 p-4 bg-white">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 bg-blue-50/50 text-gray-700 rounded-2xl px-4 py-3 resize-none border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder-blue-300"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 disabled:text-blue-100 text-white px-5 py-3 rounded-2xl transition-all duration-200 font-semibold shadow-md shadow-blue-200 hover:shadow-lg"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
