'use client'

import { useState, useEffect, useRef } from 'react'
import { sendAssistantMessage, getAssistantHistory } from '@/app/actions/assistant'
import { Sparkles, Send } from 'lucide-react'

interface Msg {
  role: 'user' | 'model'
  text: string
}

const SUGGESTIONS = [
  'What do I need to do today?',
  'Any requests waiting for me?',
  'List my open actions',
  'What happened recently on my cases?',
]

/** In-app AI assistant chat — talks to Gemini with the CRM tools. */
export function AssistantContent() {
  const [messages, setMessages] = useState<Msg[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getAssistantHistory().then(({ messages }) => {
      setMessages(messages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', text: m.text })))
    })
  }, [])

  // Grow the field with content up to ~4 lines, then scroll inside it.
  useEffect(() => {
    const t = textRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.min(t.scrollHeight, 110)}px`
  }, [text])

  // Keep the newest message in view
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, busy])

  const send = async (raw?: string) => {
    const value = (raw ?? text).trim()
    if (!value || busy) return
    setText('')
    setMessages(m => [...(m || []), { role: 'user', text: value }])
    setBusy(true)
    const { reply, error } = await sendAssistantMessage(value)
    setMessages(m => [...(m || []), { role: 'model', text: reply || error || 'No reply' }])
    setBusy(false)
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 230px)' }}>
      <div className="mt-auto space-y-2 pb-3">
        {messages === null ? (
          <p className="text-sm text-[hsl(var(--color-text-secondary))] py-6 text-center">Loading…</p>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="text-center py-10">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[hsl(var(--color-primary))]/15 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[hsl(var(--color-primary))]" />
                </div>
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">Ask me anything</p>
                <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">
                  I can read your cases and post for you — requests, messages, actions.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[hsl(var(--color-primary))] text-white rounded-br-md'
                      : 'bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-[hsl(var(--color-text-primary))] rounded-bl-md'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-text-muted))] animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input + quick prompts — sticky at the bottom of the scroll area */}
      <div className="sticky bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-2 bg-[hsl(var(--color-background))] shadow-[0_24px_0_hsl(var(--color-background))]">
        {/* Quick prompts — persistent, scrollable horizontally */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="px-3 py-1.5 rounded-full bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-xs text-[hsl(var(--color-text-secondary))] whitespace-nowrap shrink-0 active:bg-[hsl(var(--color-surface-hover))] disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ask the assistant…"
            rows={1}
            className="flex-1 min-h-10 max-h-[110px] px-3.5 py-2.5 rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none resize-none overflow-y-auto"
          />
          <button
            onClick={() => send()}
            disabled={busy || !text.trim()}
            className="w-10 h-10 rounded-xl bg-[hsl(var(--color-primary))] text-white flex items-center justify-center disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
