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

const getModelInfo = (id) => MODEL_INFO[id] || { tier: '?', label: id.split('/').pop(), desc: '', color: 'bg-gray-100 text-gray-600 border-gray-200' }

export default function Chat() {
  const [conversations, setConversations] = useState({}) // agentId -> messages[]
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState([])
  const [currentModel, setCurrentModel] = useState('')
  const [thinking, setThinking] = useState('off')
  const [agents, setAgents] = useState([])
  const [currentAgent, setCurrentAgent] = useState('main')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const messages = conversations[currentAgent] || []

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(data => {
      setModels(data.models || [])
      setCurrentModel(data.current || '')
    }).catch(() => {})
    fetch('/api/agents').then(r => r.json()).then(data => {
      setAgents(data.agents || [])
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

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const newMsg = { role: 'user', content: text, ts: Date.now() }
    setConversations(prev => ({
      ...prev,
      [currentAgent]: [...(prev[currentAgent] || []), newMsg]
    }))
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model: currentModel, thinking, agent: currentAgent })
      })
      const data = await res.json()
      const reply = { role: 'assistant', content: data.reply || data.error || 'No response', ts: Date.now() }
      setConversations(prev => ({
        ...prev,
        [currentAgent]: [...(prev[currentAgent] || []), reply]
      }))
    } catch (err) {
      const errMsg = { role: 'assistant', content: `Error: ${err.message}`, ts: Date.now() }
      setConversations(prev => ({
        ...prev,
        [currentAgent]: [...(prev[currentAgent] || []), errMsg]
      }))
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

  const curModelInfo = getModelInfo(currentModel)

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: Model selector + Agent switcher */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-blue-100 bg-white flex-wrap">
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
          <label className="text-xs text-blue-400 font-medium uppercase tracking-wide">Model</label>
          <div className="flex gap-1.5">
            {models.map(m => {
              const info = getModelInfo(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => switchModel(m.id)}
                  className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-all duration-200 border ${
                    currentModel === m.id
                      ? `${info.color} shadow-sm`
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                  }`}
                  title={info.desc}
                >
                  <span className="block">{info.tier}</span>
                  <span className="block text-[10px] font-normal opacity-75">{info.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-blue-300">
            <div className="text-center">
              <p className="text-5xl mb-4">{agents.find(a => a.id === currentAgent)?.identityEmoji || '🦞'}</p>
              <p className="text-lg font-medium">Envía un mensaje para comenzar</p>
              <p className="text-sm mt-1 text-blue-200">
                Hablando con <strong>{agents.find(a => a.id === currentAgent)?.identityName || currentAgent}</strong> · {curModelInfo.tier} ({curModelInfo.label})
              </p>
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

      {/* Thinking mode + Input */}
      <div className="border-t border-blue-100 bg-white">
        {/* Thinking toggle */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-1">
          <label className="text-xs text-blue-300 font-medium">🧠 Thinking:</label>
          {THINKING_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setThinking(mode.id)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all duration-200 ${
                thinking === mode.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-300 hover:bg-blue-100 hover:text-blue-500'
              }`}
              title={mode.desc}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-3 px-5 pb-4 pt-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Mensaje para ${agents.find(a => a.id === currentAgent)?.identityName || currentAgent}...`}
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
