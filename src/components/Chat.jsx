import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const THINKING_MODES = [
  { id: 'off',     label: 'Off',      emoji: '💤', desc: 'Sin razonamiento extra' },
  { id: 'minimal', label: 'Mínimo',   emoji: '✨', desc: 'Razonamiento mínimo' },
  { id: 'low',     label: 'Rápido',   emoji: '⚡', desc: 'Pensamiento rápido' },
  { id: 'medium',  label: 'Normal',   emoji: '🧠', desc: 'Balanceado' },
  { id: 'high',    label: 'Profundo', emoji: '🔬', desc: 'Análisis profundo' },
]

const MODEL_META = {
  'anthropic/claude-haiku-4-5':   { tier: 'Basic',  label: 'Haiku',  desc: 'Rápido · económico',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  'anthropic/claude-sonnet-4-6':  { tier: 'Medium', label: 'Sonnet', desc: 'Balanceado',            color: 'bg-blue-100 text-blue-700 border-blue-200',         dot: 'bg-blue-400' },
  'anthropic/claude-opus-4-6':    { tier: 'Hard',   label: 'Opus',   desc: 'Máxima calidad',        color: 'bg-purple-100 text-purple-700 border-purple-200',    dot: 'bg-purple-400' },
  'openai-codex/gpt-5.3-codex':   { tier: 'Code',   label: 'Codex',  desc: 'Especializado en código', color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
}
const modelMeta = (id) => MODEL_META[id] || { tier: '?', label: (id||'').split('/').pop(), desc: '', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' }

export default function Chat() {
  const [messages,     setMessages]     = useState([])
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [models,       setModels]       = useState([])
  const [currentModel, setCurrentModel] = useState('')
  const [thinking,     setThinking]     = useState('off')
  const [agents,       setAgents]       = useState([])
  const [currentAgent, setCurrentAgent] = useState('main')
  const [connected,    setConnected]    = useState(false)
  const [switchingModel, setSwitchingModel] = useState(false)
  const [switchingThinking, setSwitchingThinking] = useState(false)
  const bottomRef   = useRef(null)
  const inputRef    = useRef(null)
  const sseRef      = useRef(null)
  const userScrolled = useRef(false)

  const agentInfo = agents.find(a => a.id === currentAgent)

  // Load models + agents
  useEffect(() => {
    fetch('/api/models/list').then(r => r.json()).then(d => { setModels(d.models||[]); setCurrentModel(d.current||'') }).catch(()=>{})
    fetch('/api/agents').then(r => r.json()).then(d => setAgents(d.agents||[])).catch(()=>{})
  }, [])

  // Poll state for changes (via CLI commands)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/state')
        const data = await res.json()
        if (data.currentModel && data.currentModel !== currentModel) {
          setCurrentModel(data.currentModel)
        }
        if (data.thinking && data.thinking !== thinking) {
          setThinking(data.thinking)
        }
      } catch {}
    }, 2000) // Poll every 2 seconds
    return () => clearInterval(pollInterval)
  }, [currentModel, thinking])

  // SSE stream
  useEffect(() => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null }
    setConnected(false); setMessages([])
    const es = new EventSource(`/api/chat/stream?agent=${encodeURIComponent(currentAgent)}`)
    sseRef.current = es
    es.onopen = () => {} // wait for first message to confirm connected
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'history') {
          setMessages(data.messages || [])
          setConnected(true)
          // Reset scroll flag so initial load always jumps to bottom
          userScrolled.current = false
        }
      } catch {}
    }
    es.onerror = () => setConnected(false)
    return () => es.close()
  }, [currentAgent])

  const isFirstLoad = useRef(true)

  useEffect(() => {
    if (!userScrolled.current) {
      // Use instant scroll on first load, smooth for new messages
      const behavior = isFirstLoad.current ? 'instant' : 'smooth'
      bottomRef.current?.scrollIntoView({ behavior })
      isFirstLoad.current = false
    }
  }, [messages])

  // Reset on agent switch
  useEffect(() => {
    isFirstLoad.current = true
    userScrolled.current = false
  }, [currentAgent])

  const switchModel = async (model) => {
    setSwitchingModel(true)
    try {
      const res = await fetch('/api/model', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ model }) 
      })
      const data = await res.json()
      if (data.ok) {
        setCurrentModel(model)
        const modelLabel = models.find(m => m.id === model)?.alias || model.split('/').pop() || model
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: `🔄 Modelo cambiado a ${modelLabel}`, 
          ts: new Date().toISOString() 
        }])
      }
    } catch (err) {
      console.error('Model switch failed:', err)
    } finally {
      setSwitchingModel(false)
    }
  }

  const switchThinking = async (level) => {
    setSwitchingThinking(true)
    try {
      const res = await fetch('/api/thinking', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ thinking: level }) 
      })
      const data = await res.json()
      if (data.ok) {
        setThinking(level)
        const levelLabel = THINKING_MODES.find(m => m.id === level)?.label || level
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: `🧠 Razonamiento: ${levelLabel}`, 
          ts: new Date().toISOString() 
        }])
      }
    } catch (err) {
      console.error('Thinking switch failed:', err)
    } finally {
      setSwitchingThinking(false)
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput(''); userScrolled.current = false
    setMessages(prev => [...prev, { role: 'user', content: text, ts: new Date().toISOString() }])
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model: currentModel, thinking, agent: currentAgent })
      })
      const data = await res.json()
      if (data.reply) setMessages(prev => [...prev, { role: 'assistant', content: data.reply, ts: new Date().toISOString() }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, ts: new Date().toISOString() }])
    }
    setLoading(false); inputRef.current?.focus()
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const handleScroll = (e) => { const el = e.target; userScrolled.current = el.scrollHeight - el.scrollTop - el.clientHeight > 120 }

  const curMeta = modelMeta(currentModel)

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Agent hero bar ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-6 py-4">
        <div className="flex items-center justify-between gap-4">

          {/* Agent selector — all agents in one row, active one is expanded */}
          <div className="flex items-center gap-3">
            {agents.map(a => {
              const active = a.id === currentAgent
              return (
                <button
                  key={a.id}
                  onClick={() => setCurrentAgent(a.id)}
                  className={`flex items-center gap-3 rounded-2xl transition-all duration-200 border-2 ${
                    active
                      ? 'bg-white border-blue-300 shadow-md px-4 py-2.5'
                      : 'bg-white/50 border-transparent hover:border-blue-200 hover:bg-white/80 px-3 py-2'
                  }`}
                >
                  <span className={`transition-all duration-200 ${active ? 'text-3xl' : 'text-2xl opacity-60'}`}>
                    {a.identityEmoji || '🤖'}
                  </span>
                  {active && (
                    <div className="text-left">
                      <p className="text-base font-bold text-gray-800 leading-tight">{a.identityName || a.id}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-300'}`} />
                        <span className="text-xs text-gray-400">{connected ? 'En vivo' : 'Conectando...'}</span>
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Model picker */}
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[11px] text-blue-400 font-semibold uppercase tracking-widest">Modelo</span>
            <div className="flex gap-1.5">
              {models.map(m => {
                const meta = modelMeta(m.id)
                const active = currentModel === m.id
                return (
                  <button key={m.id} 
                    onClick={() => switchModel(m.id)} 
                    disabled={switchingModel}
                    title={meta.desc}
                    className={`flex flex-col items-center px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all duration-200 ${
                      switchingModel ? 'opacity-50 cursor-wait' : ''
                    } ${
                      active ? `${meta.color} border-current shadow-sm` : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500'
                    }`}>
                    <span>{switchingModel && active ? '⏳' : meta.tier}</span>
                    <span className="font-normal opacity-70 text-[10px]">{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50/50" onScroll={handleScroll}>
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className={`w-20 h-20 rounded-3xl border-2 flex items-center justify-center text-4xl mb-5 shadow-sm transition-all ${connected ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
              {connected ? (agentInfo?.identityEmoji || '🦞') : '⏳'}
            </div>
            <p className="text-lg font-bold text-gray-700">
              {connected ? (agentInfo?.identityName || currentAgent) : 'Conectando...'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {connected ? '¡Escríbeme algo para comenzar! ✨' : 'Cargando conversación...'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'system') {
            return (
              <div key={`${msg.ts}-${i}`} className="flex justify-center">
                <div className="bg-blue-50 text-blue-600 text-xs px-3 py-1.5 rounded-full border border-blue-200 font-medium">
                  {msg.content}
                </div>
              </div>
            )
          }
          return (
            <div key={`${msg.ts}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">
                  {agentInfo?.identityEmoji || '🦞'}
                </div>
              )}
              <div className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-200 rounded-br-sm'
                  : 'bg-white text-gray-700 border border-blue-100 shadow-sm rounded-bl-sm'
              }`}>
                {msg.role === 'assistant'
                  ? <div className="chat-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                  : <p className="whitespace-pre-wrap">{msg.content}</p>
                }
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="flex justify-start items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-sm flex-shrink-0">
              {agentInfo?.identityEmoji || '🦞'}
            </div>
            <div className="bg-white border border-blue-100 rounded-2xl rounded-bl-sm px-5 py-3.5 shadow-sm">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      <div className="bg-white border-t border-blue-100 px-5 pt-3 pb-5">
        {/* Thinking mode */}
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-xs text-gray-400 font-semibold mr-1">Razonamiento:</span>
          {THINKING_MODES.map(m => (
            <button key={m.id} 
              onClick={() => switchThinking(m.id)} 
              disabled={switchingThinking}
              title={m.desc}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                switchingThinking ? 'opacity-50 cursor-wait' : ''
              } ${
                thinking === m.id
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                  : 'bg-blue-50 text-blue-400 hover:bg-blue-100'
              }`}>
              <span>{switchingThinking && thinking === m.id ? '⏳' : m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* Text input */}
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Mensaje para ${agentInfo?.identityName || currentAgent}...`}
            rows={1}
            style={{ minHeight: '48px', maxHeight: '160px' }}
            className="flex-1 bg-blue-50/60 text-gray-700 rounded-2xl px-5 py-3 resize-none border-2 border-blue-100 focus:border-blue-400 focus:outline-none focus:bg-white transition-all placeholder-blue-300 text-sm leading-relaxed"
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="h-12 px-6 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-blue-200 disabled:text-blue-100 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:shadow-xl transition-all duration-200 flex-shrink-0"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
