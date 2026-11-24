'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { sendAssistantMessage, sendAssistantVoice, getAssistantAudioUrl, getAssistantHistory, type StagedFile } from '@/app/actions/assistant'
import { createClient } from '@/lib/supabase/client'
import { usePaneLink, usePaneStack } from '@/lib/panes'
import { Sparkles, Send, Paperclip, Zap, X, History, Mic, Square } from 'lucide-react'

interface Msg {
  role: 'user' | 'model'
  text: string
  audioPath?: string | null
}

const SUGGESTIONS = [
  'What do I need to do today?',
  'Any requests waiting for me?',
  'Check my notifications',
  "What's late or neglected?",
  'What happened recently on my cases?',
]

function BubbleLink({ href, label, stack }: { href: string; label: string; stack?: string[] }) {
  const paneLink = usePaneLink(href)
  const openStack = usePaneStack()
  return (
    <Link
      {...paneLink}
      onClick={(e) => {
        if (stack && openStack(stack)) { e.preventDefault(); return }
        paneLink.onClick(e)
      }}
      className="text-blue-400"
    >
      {label}
    </Link>
  )
}

const LINK_RE = /\[([^\]]+)\]\((\/[a-zA-Z0-9/_?=&%.-]+)\)|\b(C\d{5,6})\b/g

/** Parse [label](/path) links the model emits, plus bare case codes. Case
 *  references open the case AND its progress as stacked panes on desktop;
 *  on mobile the href itself points at /progress. */
export function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    let href = m[2] ?? `/cases/${m[3]}/progress`
    let stack: string[] | undefined
    const caseMatch = href.match(/^\/cases\/([^/]+)$/)
    if (caseMatch) {
      href = `/cases/${caseMatch[1]}/progress`
      stack = [`/cases/${caseMatch[1]}`, href]
    } else if (m[3]) {
      stack = [`/cases/${m[3]}`, href]
    }
    nodes.push(<BubbleLink key={m.index} href={href} label={m[1] ?? m[3]} stack={stack} />)
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** Voice bubble — native player + collapsible transcript. */
export function AudioBubble({ path, transcript }: { path: string; transcript: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [showTx, setShowTx] = useState(false)
  useEffect(() => {
    getAssistantAudioUrl(path).then(r => setUrl(r.url ?? null))
  }, [path])
  return (
    <div>
      {url
        ? <audio controls src={url} preload="metadata" className="h-9 max-w-full" />
        : <div className="h-9 w-44 rounded bg-white/10 animate-pulse" />}
      <button onClick={() => setShowTx(s => !s)} className="block mt-1 text-[11px] font-medium text-blue-200/90">
        {showTx ? 'Hide transcript' : 'Show transcript'}
      </button>
      {showTx && <p className="mt-1 whitespace-pre-wrap">{transcript || '…'}</p>}
    </div>
  )
}

/** In-app AI assistant chat — talks to Gemini with the CRM tools. */
export function AssistantContent() {
  const [messages, setMessages] = useState<Msg[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [quickOpen, setQuickOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recSecs, setRecSecs] = useState(0)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const discardRef = useRef(false)
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const meRef = useRef<string | null>(null)
  const busyRef = useRef(false)
  const composerRef = useRef<HTMLDivElement>(null)
  const [composerH, setComposerH] = useState(0)
  const sessionsLink = usePaneLink('/assistant/sessions')
  const tz = new Date().getTimezoneOffset()

  // The composer is `fixed` on mobile — measure it so the spacer below
  // keeps the last message scrollable clear of it.
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setComposerH(el.offsetHeight))
    ro.observe(el)
    setComposerH(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    getAssistantHistory(tz).then(({ messages }) => {
      setMessages(messages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', text: m.text, audioPath: m.audio_path })))
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
    // busyRef (not the state) guards re-entry — two taps within one tick
    // would otherwise both pass before setBusy commits.
    if (!value || busyRef.current) return
    busyRef.current = true
    setText('')
    setStaged([])
    setQuickOpen(false)
    setMessages(m => [...(m || []), { role: 'user', text: value }])
    setBusy(true)
    const { reply, error } = await sendAssistantMessage(value, staged, tz)
    setMessages(m => [...(m || []), { role: 'model', text: reply || error || 'No reply' }])
    setBusy(false)
    busyRef.current = false
  }

  const myId = async () => {
    if (!meRef.current) {
      const { data: { user } } = await createClient().auth.getUser()
      meRef.current = user?.id ?? null
    }
    return meRef.current
  }

  const attachFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setNotice(null)
    const uid = await myId()
    if (!uid) { setNotice('Upload failed — not signed in'); return }
    const supabase = createClient()
    const failed: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `staging/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
      const { error } = await supabase.storage.from('case_attachments').upload(path, file, { cacheControl: '3600', upsert: false })
      if (error) failed.push(file.name)
      else setStaged(s => [...s, { path, name: file.name, size: file.size, type: file.type }])
    }
    if (failed.length) setNotice(`Couldn't upload: ${failed.join(', ')}`)
  }

  const startRecording = async () => {
    if (busyRef.current || recording) return
    setNotice(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      discardRef.current = false
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const type = rec.mimeType || 'audio/webm'
        if (!discardRef.current) void sendVoice(new Blob(chunksRef.current, { type }), type)
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
      setRecSecs(0)
      recTimer.current = setInterval(() => setRecSecs(s => s + 1), 1000)
    } catch {
      setNotice("Microphone isn't available — check the browser permission.")
    }
  }

  const stopRecording = (discard: boolean) => {
    discardRef.current = discard
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    if (recTimer.current) { clearInterval(recTimer.current); recTimer.current = null }
  }

  const sendVoice = async (blob: Blob, mime: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const uid = await myId()
      if (!uid) { setNotice('Upload failed — not signed in'); return }
      const ext = mime.includes('mp4') ? 'm4a' : 'webm'
      const path = `staging/${uid}/voice-${Date.now()}.${ext}`
      const supabase = createClient()
      const { error: upErr } = await supabase.storage.from('case_attachments').upload(path, blob, { contentType: mime })
      if (upErr) { setNotice(`Voice upload failed: ${upErr.message}`); return }

      const idx = (messages || []).length
      setMessages(m => [...(m || []), { role: 'user', text: '', audioPath: path }])
      const { reply, transcript, error } = await sendAssistantVoice(path, mime, tz)
      if (error || !transcript) {
        setMessages(m => (m || []).map((msg, i) => i === idx ? { ...msg, text: `⚠ ${error || 'Transcription failed'}` } : msg))
        return
      }
      setMessages(m => (m || []).map((msg, i) => i === idx ? { ...msg, text: transcript } : msg))
      setMessages(m => [...(m || []), { role: 'model', text: reply || 'No reply' }])
    } finally {
      setBusy(false)
      busyRef.current = false
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
                  {m.audioPath ? <AudioBubble path={m.audioPath} transcript={m.text} /> : linkify(m.text)}
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

      {/* Spacer: on mobile the composer is fixed above the tab bar, so this
          reserves the same room in the flow — desktop's sticky needs none. */}
      <div className="md:hidden" style={{ height: composerH }} />

      {/* Input area — fixed above the tab bar on mobile, sticky on desktop */}
      <div
        ref={composerRef}
        className="fixed z-40 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 px-4 pt-2 pb-2 bg-[hsl(var(--color-background))] md:sticky md:bottom-0 md:left-auto md:right-auto md:-mx-6 md:px-6 shadow-[0_24px_0_hsl(var(--color-background))]"
      >
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
        {notice && (
          <p className="pb-2 text-xs text-red-400">{notice}</p>
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
          {recording ? (
            <>
              <div className="flex-1 min-h-10 flex items-center gap-2 px-3.5 rounded-xl bg-[hsl(var(--color-input-bg))] border border-red-400/50">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-sm text-red-400">Recording · {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}</span>
              </div>
              <button
                onClick={() => stopRecording(true)}
                className="w-10 h-10 rounded-xl bg-[hsl(var(--color-surface-active))] flex items-center justify-center text-[hsl(var(--color-text-secondary))] shrink-0"
                aria-label="Discard recording"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => stopRecording(false)}
                className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0"
                aria-label="Send voice message"
              >
                <Square className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <textarea
                ref={textRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder="Ask the assistant…"
                rows={1}
                disabled={busy}
                className="flex-1 min-h-10 max-h-[110px] px-3.5 py-2.5 rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none resize-none overflow-y-hidden disabled:opacity-60"
              />
              {text.trim() || staged.length ? (
                <button
                  onClick={() => send()}
                  disabled={busy}
                  className="w-10 h-10 rounded-xl bg-[hsl(var(--color-primary))] text-white flex items-center justify-center disabled:opacity-40 shrink-0"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={busy}
                  className="w-10 h-10 rounded-xl bg-[hsl(var(--color-surface-active))] flex items-center justify-center text-[hsl(var(--color-text-secondary))] disabled:opacity-40 shrink-0"
                  aria-label="Record voice message"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
