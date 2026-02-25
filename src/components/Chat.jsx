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
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900/50 flex-wrap">
        {/* Model selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Model:</label>
          <select
            value={currentModel}
            onChange={e => switchModel(e.target.value)}
            className="bg-gray-800 text-sm text-gray-200 rounded px-2 py-1 border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>
                {m.alias || m.id}
              </option>
            ))}
          </select>
        </div>

        {/* Thinking mode */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 mr-1">Thinking:</label>
          {THINKING_MODES.map(mode => (
            <button
              key={mode}
              onClick={() => switchThinking(mode)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                thinking === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <p className="text-4xl mb-3">🦞</p>
              <p>Envía un mensaje para comenzar</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-200'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="chat-markdown">
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
            <div className="bg-gray-800 rounded-xl px-4 py-2.5 text-gray-400">
              <span className="animate-pulse">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4 bg-gray-900/50">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 bg-gray-800 text-gray-200 rounded-xl px-4 py-2.5 resize-none border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2.5 rounded-xl transition-colors font-medium"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
