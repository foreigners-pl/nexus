'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getViewAsUser, getViewAsSessions, getViewAsSession, getViewAsAudioUrl, nudgeUser } from '@/app/actions/viewas'
import { RequestsContent } from '@/components/mobile/RequestsContent'
import { ActionsContent } from '@/components/mobile/ActionsContent'
import MobileHomePage from '@/app/(dashboard)/home/page'
import { usePaneBack } from '@/lib/panes'
import { linkify, AudioBubble } from '@/components/mobile/AssistantContent'
import { ChevronLeft, ChevronRight, Loader2, Bot, History, BellRing } from 'lucide-react'

type View = 'home' | 'requests' | 'actions' | 'ai'

const fmtDate = (key: string) => key.split('-').reverse().join('/')
const sessionLabel = (key: string, todayKey: string) => {
  if (key === todayKey) return `Today · ${fmtDate(key)}`
  const weekday = new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
  return `${weekday} · ${fmtDate(key)}`
}
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

/** Read-only day transcript — snaps to the newest message on load. */
function Transcript({ userId, date, tz, today, fetchAudio, footer }: {
  userId: string
  date: string
  tz: number
  today: string
  fetchAudio: (path: string) => Promise<string | null>
  footer?: React.ReactNode
}) {
  const [messages, setMessages] = useState<any[] | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getViewAsSession(userId, date, tz).then(r => setMessages(r.messages))
  }, [userId, date, tz])

  // Start at the bottom — newest messages, no animated scroll.
  useEffect(() => {
    if (!messages?.length) return
    let scroller = endRef.current?.parentElement ?? null
    while (scroller) {
      const o = getComputedStyle(scroller).overflowY
      if ((o === 'auto' || o === 'scroll') && scroller.scrollHeight > scroller.clientHeight) break
      scroller = scroller.parentElement
    }
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'auto' })
    else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' })
  }, [messages])

  return (
    <div>
      <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))] mb-3 px-1">{sessionLabel(date, today)}</p>
      <div className="space-y-2">
        {messages === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-8 text-center">
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">No messages this day</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[hsl(var(--color-primary))] text-white rounded-br-md'
                    : 'bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-[hsl(var(--color-text-primary))] rounded-bl-md'
                }`}
              >
                {m.audio_path
                  ? <AudioBubble path={m.audio_path} transcript={m.text} fetchUrl={fetchAudio} />
                  : linkify(m.text)}
              </div>
            </div>
          ))
        )}
      </div>
      <div ref={endRef} />
      {footer}
    </div>
  )
}

function AiView({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<{ date: string; count: number; tokens: number }[] | null>(null)
  const [view, setView] = useState<'chat' | 'sessions' | { date: string }>('chat')
  const [today] = useState(() => {
    const off = new Date().getTimezoneOffset() * 60000
    return new Date(Date.now() - off).toISOString().slice(0, 10)
  })
  const tz = new Date().getTimezoneOffset()
  const fetchAudio = (path: string) => getViewAsAudioUrl(userId, path).then(r => r.url ?? null)

  useEffect(() => {
    if (view !== 'chat')
      getViewAsSessions(userId, tz).then(r => setSessions(r.sessions))
  }, [userId, view])

  // Default: today's conversation — the Sessions pill sits where their
  // composer would be, read-only.
  if (view === 'chat') {
    return (
      <Transcript
        userId={userId}
        date={today}
        tz={tz}
        today={today}
        fetchAudio={fetchAudio}
        footer={
          <div className="sticky bottom-0 pt-3 pb-1 bg-[hsl(var(--color-background))]">
            <button
              onClick={() => setView('sessions')}
              className="w-full h-11 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] text-sm font-semibold text-[hsl(var(--color-text-primary))] flex items-center justify-center gap-2 active:bg-[hsl(var(--color-surface-hover))]"
            >
              <History className="w-4 h-4" /> Sessions
            </button>
          </div>
        }
      />
    )
  }

  if (typeof view === 'object') {
    return (
      <div>
        <button
          onClick={() => setView('sessions')}
          className="inline-flex items-center gap-1 text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> Sessions
        </button>
        <Transcript userId={userId} date={view.date} tz={tz} today={today} fetchAudio={fetchAudio} />
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setView('chat')}
        className="inline-flex items-center gap-1 text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] mb-3"
      >
        <ChevronLeft className="w-4 h-4" /> Chat
      </button>
      {sessions === null ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" /></div>
      ) : !sessions.length ? (
        <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-8 text-center">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">No assistant sessions yet</p>
        </div>
      ) : (
        <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
          {sessions.map(s => (
            <li key={s.date}>
              <button
                onClick={() => setView({ date: s.date })}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[hsl(var(--color-surface-hover))]"
              >
                <Bot className="w-4 h-4 shrink-0 text-[hsl(var(--color-primary))]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-[hsl(var(--color-text-primary))] truncate">
                    {sessionLabel(s.date, today)}
                  </p>
                  <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5">
                    {s.count} message{s.count === 1 ? '' : 's'}{s.tokens > 0 && ` · ${fmtTokens(s.tokens)} tokens`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ViewAsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const router = useRouter()
  const paneBack = usePaneBack()
  const [user, setUser] = useState<{ id: string; name: string; role: string | null } | null>(null)
  const [view, setView] = useState<View>('home')
  const [nudging, setNudging] = useState(false)
  const [nudgeResult, setNudgeResult] = useState<string | null>(null)

  useEffect(() => {
    getViewAsUser(userId).then(setUser)
  }, [userId])

  async function nudge() {
    if (nudging) return
    setNudging(true)
    setNudgeResult(null)
    const res = await nudgeUser(userId)
    setNudging(false)
    setNudgeResult(res.error ?? `Sent — the assistant pinged ${user?.name ?? 'them'}.`)
    setTimeout(() => setNudgeResult(null), 4000)
  }

  const exitMirror = () => (paneBack ? paneBack() : router.push('/admin/usage'))

  if (view === 'home') {
    return (
      <MobileHomePage
        viewAsUserId={userId}
        onBack={exitMirror}
        onOpenTab={t => setView(t === 'assistant' ? 'ai' : t)}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setView('home')}
          aria-label="Back"
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))]"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <p className="flex-1 text-lg font-semibold text-[hsl(var(--color-text-primary))] truncate">
          {view === 'requests' ? 'Requests' : view === 'actions' ? 'Actions' : 'Assistant'}
          <span className="text-sm font-normal text-[hsl(var(--color-text-secondary))]"> — {user?.name ?? '…'}</span>
        </p>
        <button
          onClick={nudge}
          disabled={nudging}
          title="Send them an AI nudge summarizing what's pending"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 text-amber-400 text-xs font-semibold hover:bg-amber-400/20 transition-colors disabled:opacity-50"
        >
          {nudging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
          Nudge
        </button>
      </div>
      {nudgeResult && (
        <p className="text-xs text-[hsl(var(--color-text-secondary))] -mt-2 mb-3 px-1">{nudgeResult}</p>
      )}
      {view === 'requests' ? (
        <RequestsContent viewAsUserId={userId} />
      ) : view === 'actions' ? (
        <ActionsContent viewAsUserId={userId} />
      ) : (
        <AiView userId={userId} />
      )}
    </div>
  )
}
