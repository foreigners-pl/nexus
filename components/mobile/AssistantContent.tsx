'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { sendAssistantMessage, getAssistantHistory, type StagedFile } from '@/app/actions/assistant'
import { createClient } from '@/lib/supabase/client'
import { usePaneLink } from '@/lib/panes'
import { Sparkles, Send, Paperclip, Zap, X, History } from 'lucide-react'

interface Msg {
  role: 'user' | 'model'
  text: string
}

const SUGGESTIONS = [
  'What do I need to do today?',
  'Any requests waiting for me?',
  'Check my notifications',
  "What's late or neglected?",
  'What happened recently on my cases?',
]

function BubbleLink({ href, label }: { href: string; label: string }) {
  const paneLink = usePaneLink(href)
  return <Link {...paneLink} className="text-blue-400">{label}</Link>
}

const LINK_RE = /\[([^\]]+)\]\((\/[a-zA-Z0-9/_?=&%.-]+)\)|\b(C\d{5,6})\b/g

/** Parse [label](/path) links the model emits, plus bare case codes. */
export function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    nodes.push(
      <BubbleLink key={m.index} href={m[2] ?? `/cases/${m[3]}`} label={m[1] ?? m[3]} />
    )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** In-app AI assistant chat — talks to Gemini with the CRM tools. */
export function AssistantContent() {
  const [messages, setMessages] = useState<Msg[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [quickOpen, setQuickOpen] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const meRef = useRef<string | null>(null)
  const sessionsLink = usePaneLink('/assistant/sessions')
  const tz = new Date().getTimezoneOffset()

  useEffect(() => {
    getAssistantHistory(tz).then(({ messages }) => {
      setMessages(messages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', text: m.text })))
    })
  }, [])

  // Grow the field with content up to ~4 lines; scroll inside only at the cap.
  useEffect(() => {
    const t = textRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.min(t.scrollHeight, 110)}px`
    t.style.overflowY = t.scrollHeight > 110 ? 'auto' : 'hidden'
  }, [text])

  // Keep the newest message in view — scroll the chat's own scroller to the
  // absolute bottom so the reply rests above the sticky composer, not behind it.
  useEffect(() => {
    let scroller = scrollRef.current?.parentElement ?? null
    while (scroller) {
      const o = getComputedStyle(scroller).overflowY
      if ((o === 'auto' || o === 'scroll') && scroller.scrollHeight > scroller.clientHeight) break
      scroller = scroller.parentElement
    }
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
    else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const send = async (raw?: string) => {
    const value = (raw ?? text).trim() || (staged.length ? 'Attach the staged file(s)' : '')
    if (!value || busy) return
    setText('')
    setStaged([])
    setQuickOpen(false)
    setMessages(m => [...(m || []), { role: 'user', text: value }])
    setBusy(true)
    const { reply, error } = await sendAssistantMessage(value, staged, tz)
    setMessages(m => [...(m || []), { role: 'model', text: reply || error || 'No reply' }])
    setBusy(false)
  }

  const attachFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const supabase = createClient()
    if (!meRef.current) {
      const { data: { user } } = await supabase.auth.getUser()
      meRef.current = user?.id ?? null
    }
    if (!meRef.current) return
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `staging/${meRef.current}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
      const { error } = await supabase.storage.from('case_attachments').upload(path, file, { cacheControl: '3600', upsert: false })
      if (!error) setStaged(s => [...s, { path, name: file.name, size: file.size, type: file.type }])
    }
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
                  I can read your cases and post for you — requests, messages, actions, files.
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
                  {linkify(m.text)}
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

      {/* Input area — sticky at the bottom of the scroll region */}
      <div className="sticky bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-2 bg-[hsl(var(--color-background))] shadow-[0_24px_0_hsl(var(--color-background))]">
        {staged.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-2">
            {staged.map(f => (
              <span key={f.path} className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--color-surface-active))] px-2.5 py-1.5 text-xs text-[hsl(var(--color-text-secondary))]">
                <Paperclip className="w-3 h-3" />
                <span className="max-w-[160px] truncate">{f.name}</span>
                <button onClick={() => setStaged(s => s.filter(x => x.path !== f.path))} className="text-[hsl(var(--color-text-muted))]">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Actions row — quick actions and attach split the width */}
        <div className="flex gap-2 pb-2">
          <div className="relative flex-1">
            {quickOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setQuickOpen(false)} />
                <div className="absolute left-0 bottom-full mb-1 z-50 w-64 max-w-[80vw] bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left px-4 py-3 text-sm text-[hsl(var(--color-text-primary))] active:bg-[hsl(var(--color-surface-hover))] border-b border-[hsl(var(--color-border))] last:border-b-0"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              onClick={() => setQuickOpen(o => !o)}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-xs text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))] disabled:opacity-40 whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5 text-[hsl(var(--color-primary))]" />
              Quick actions
            </button>
          </div>
          <input type="file" ref={fileRef} multiple className="hidden" onChange={e => { attachFiles(e.target.files); e.target.value = '' }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-xs text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))] disabled:opacity-40 whitespace-nowrap"
          >
            <Paperclip className="w-3.5 h-3.5 text-[hsl(var(--color-primary))]" />
            Attach files
          </button>
          <Link
            {...sessionsLink}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-xs text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))] whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5 text-[hsl(var(--color-primary))]" />
            Sessions
          </Link>
        </div>

        <div className="flex gap-2 items-end">
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ask the assistant…"
            rows={1}
            className="flex-1 min-h-10 max-h-[110px] px-3.5 py-2.5 rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none resize-none overflow-y-hidden"
          />
          <button
            onClick={() => send()}
            disabled={busy || (!text.trim() && staged.length === 0)}
            className="w-10 h-10 rounded-xl bg-[hsl(var(--color-primary))] text-white flex items-center justify-center disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
