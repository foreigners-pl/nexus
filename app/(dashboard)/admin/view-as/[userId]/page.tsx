'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { getViewAsUser, getViewAsSessions, getViewAsSession, getViewAsAudioUrl } from '@/app/actions/viewas'
import { RequestsContent } from '@/components/mobile/RequestsContent'
import { ActionsContent } from '@/components/mobile/ActionsContent'
import MobileHomePage from '@/app/(dashboard)/home/page'
import { linkify, AudioBubble } from '@/components/mobile/AssistantContent'
import { ChevronLeft, ChevronRight, Loader2, Eye, Bot } from 'lucide-react'

type Tab = 'home' | 'requests' | 'actions' | 'ai'

const fmtDate = (key: string) => key.split('-').reverse().join('/')
const sessionLabel = (key: string, todayKey: string) => {
  if (key === todayKey) return `Today · ${fmtDate(key)}`
  const weekday = new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
  return `${weekday} · ${fmtDate(key)}`
}
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

function AiTab({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<{ date: string; count: number; tokens: number }[] | null>(null)
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[] | null>(null)
  const [today] = useState(() => {
    const off = new Date().getTimezoneOffset() * 60000
    return new Date(Date.now() - off).toISOString().slice(0, 10)
  })
  const tz = new Date().getTimezoneOffset()

  useEffect(() => {
    getViewAsSessions(userId, tz).then(r => setSessions(r.sessions))
  }, [userId])

  useEffect(() => {
    if (!openDate) return
    setMessages(null)
    getViewAsSession(userId, openDate, tz).then(r => setMessages(r.messages))
  }, [userId, openDate])

  const fetchAudio = (path: string) => getViewAsAudioUrl(userId, path).then(r => r.url ?? null)

  if (openDate) {
    return (
      <div>
        <button
          onClick={() => { setOpenDate(null); setMessages(null) }}
          className="inline-flex items-center gap-1 text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> Sessions
        </button>
        <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))] mb-3 px-1">{sessionLabel(openDate, today)}</p>
        <div className="space-y-2">
          {messages === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-[hsl(var(--color-text-secondary))] py-6 text-center">No messages this day</p>
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
      </div>
    )
  }

  if (sessions === null) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" /></div>
  }
  if (!sessions.length) {
    return (
      <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-8 text-center">
        <p className="text-sm text-[hsl(var(--color-text-secondary))]">No assistant sessions yet</p>
      </div>
    )
  }
  return (
    <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
      {sessions.map(s => (
        <li key={s.date}>
          <button
            onClick={() => setOpenDate(s.date)}
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
  )
}

export default function ViewAsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const [user, setUser] = useState<{ id: string; name: string; role: string | null } | null>(null)
  const [tab, setTab] = useState<Tab>('home')

  useEffect(() => {
    getViewAsUser(userId).then(setUser)
  }, [userId])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'requests', label: 'Requests' },
    { id: 'actions', label: 'Actions' },
    { id: 'ai', label: 'AI sessions' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20">
      <Link
        href="/admin/usage"
        className="inline-flex items-center gap-1 text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Usage overview
      </Link>

      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] truncate">
          {user ? `Viewing as ${user.name}` : 'Viewing as…'}
        </h1>
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wide bg-amber-400/10 text-amber-400 shrink-0">
          <Eye className="w-3 h-3" /> View only
        </span>
      </div>
      <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-5">
        Their pages exactly as they see them — nothing here can be changed.
      </p>

      <div className="flex gap-1 p-1 rounded-xl bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] mb-5 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-[hsl(var(--color-primary))] text-white'
                : 'text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'home' ? (
        <MobileHomePage
          viewAsUserId={userId}
          onOpenTab={t => setTab(t === 'assistant' ? 'ai' : t)}
        />
      ) : tab === 'requests' ? (
        <RequestsContent viewAsUserId={userId} />
      ) : tab === 'actions' ? (
        <ActionsContent viewAsUserId={userId} />
      ) : (
        <AiTab userId={userId} />
      )}
    </div>
  )
}
