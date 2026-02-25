import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const THINKING_MODES = [
  { id: 'off', label: 'Off', desc: 'Sin razonamiento extra' },
  { id: 'low', label: 'Low', desc: 'Rápido' },
  { id: 'medium', label: 'Med', desc: 'Balanceado' },
  { id: 'high', label: 'High', desc: 'Profundo' },
]

const MODEL_INFO = {
  'anthropic/claude-haiku-4-5': { tier: 'Basic', label: 'Haiku', desc: 'Rápido y económico — tareas simples', color: 'bg-green-100 text-green-700 border-green-200' },
  'anthropic/claude-sonnet-4-6': { tier: 'Medium', label: 'Sonnet', desc: 'Balanceado — la mayoría de tareas', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'anthropic/claude-opus-4-6': { tier: 'Hard', label: 'Opus', desc: 'Máxima calidad — tareas complejas', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  'openai-codex/gpt-5.3-codex': { tier: 'Code', label: 'Codex', desc: 'Especializado en código', color: 'bg-amber-100 text-amber-700 border-amber-200' },
}

const getModelInfo = (id) => MODEL_INFO[id] || { tier: '?', label: (id || '').split('/').pop(), desc: '', color: 'bg-gray-100 text-gray-600 border-gray-200' }

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState([])
  const [currentModel, setCurrentModel] = useState('')
  const [thinking, setThinking] = useState('off')
  const [agents, setAgents] = useState([])
  const [currentAgent, setCurrentAgent] = useState('main')
  const [sessionId, setSessionId] = useState(null)
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const sseRef = useRef(null)
  const userScrolled = useRef(false)

  // Load models + agents
  useEffect(() => {
    fetch('/api/models/list').then(r => r.json()).then(data => {
      setModels(data.models || [])
      setCurrentModel(data.current || '')
    }).catch(() => {})
    fetch('/api/agents').then(r => r.json()).then(data => {
      setAgents(data.agents || [])
    }).catch(() => {})
  }, [])

  // Connect SSE for live updates when agent changes
  useEffect(() => {
    // Close existing connection
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }
    setConnected(false)
    setMessages([])

    const es = new EventSource(`/api/chat/stream?agent=${encodeURIComponent(currentAgent)}`)
    sseRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'history') {
          setMessages(data.messages || [])
          setConnected(true)
        } else if (data.type === 'message') {
          setMessages(prev => {
            const exists = prev.some(m => m.ts === data.message.ts && m.content === data.message.content)
            if (exists) return prev
            return [...prev, data.message]
          })
        }
      } catch {}
    }

    es.onerror = () => setConnected(false)

    return () => { es.close() }
  }, [currentAgent])

  // Load sessionId
  useEffect(() => {
    fetch(`/api/chat/history?agent=${encodeURIComponent(currentAgent)}`)
      .then(r => r.json())
      .then(data => setSessionId(data.sessionId))
      .catch(() => {})
  }, [currentAgent])

  // Auto-scroll
  useEffect(() => {
    if (!userScrolled.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Reset scroll flag on agent change
  useEffect(() => { userScrolled.current = false }, [currentAgent])

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

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    userScrolled.current = false

    // Optimistically add user message
    const tempMsg = { role: 'user', content: text, ts: new Date().toISOString() }
    setMessages(prev => [...prev, tempMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model: currentModel, thinking, agent: currentAgent })
      })
      const data = await res.json()
      // SSE will pick up the real messages from file, but add reply in case SSE is slow
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, ts: new Date().toISOString() }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, ts: new Date().toISOString() }])
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

  const handleScroll = (e) => {
    const el = e.target
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    userScrolled.current = !isAtBottom
  }

  const curModelInfo = getModelInfo(currentModel)
  const currentAgentInfo = agents.find(a => a.id === currentAgent)

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-blue-100 bg-white flex-wrap">
        {/* Agent switcher */}
        <div className="flex items-center gap-1.5">
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => setCurrentAgent(a.id)}
              className={`px-3 py-1.5 text-sm rounded-xl font-medium transition-all duration-200 flex items-center gap-1.5 ${
                currentAgent === a.id
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                  : 'bg-blue-50 text-blue-400 hover:bg-blue-100 border border-blue-100'
              }`}
            >
              <span>{a.identityEmoji || '🤖'}</span>
              {a.identityName || a.id}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-blue-100"></div>

        {/* Model selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-blue-300 font-medium uppercase tracking-wide">Model</label>
          <div className="flex gap-1.5">
            {models.map(m => {
              const info = getModelInfo(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => switchModel(m.id)}
                  title={info.desc}
                  className={`px-3 py-1 text-xs rounded-xl font-semibold transition-all duration-200 border ${
                    currentModel === m.id
                      ? `${info.color} shadow-sm`
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="block leading-tight">{info.tier}</span>
                  <span className="block text-[10px] font-normal opacity-70 leading-tight">{info.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Live indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-300'}`}></div>
          <span className="text-xs text-gray-400">{connected ? 'En vivo' : 'Desconectado'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3" onScroll={handleScroll}>
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-blue-300">
            <div className="text-center">
              <p className="text-5xl mb-4">{currentAgentInfo?.identityEmoji || '🦞'}</p>
              <p className="text-lg font-medium text-blue-400">
                {currentAgentInfo?.identityName || currentAgent}
              </p>
              <p className="text-sm mt-1 text-blue-200">
                {connected ? 'No hay mensajes recientes' : 'Conectando...'}
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={`${msg.ts}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                : 'bg-white text-gray-700 border border-blue-100 shadow-sm'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="chat-md text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-blue-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div>
              </div>
              <span className="text-xs text-blue-400">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Thinking mode + Input */}
      <div className="border-t border-blue-100 bg-white">
        <div className="flex items-center gap-2 px-5 pt-3 pb-1">
          <label className="text-xs text-blue-300 font-medium">🧠 Thinking:</label>
          {THINKING_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setThinking(mode.id)}
              title={mode.desc}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all duration-200 ${
                thinking === mode.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-300 hover:bg-blue-100 hover:text-blue-500'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 px-5 pb-4 pt-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Mensaje para ${currentAgentInfo?.identityName || currentAgent}...`}
            rows={1}
            className="flex-1 bg-blue-50/50 text-gray-700 rounded-2xl px-4 py-3 resize-none border border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder-blue-300 text-sm"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 disabled:text-blue-100 text-white px-5 py-3 rounded-2xl transition-all duration-200 font-semibold shadow-md shadow-blue-200 hover:shadow-lg text-sm"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
