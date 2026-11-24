'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getAssistantSessions, getAssistantSession } from '@/app/actions/assistant'
import { usePaneLink } from '@/lib/panes'
import { MobileBackHeader } from '@/components/mobile/MobileBackHeader'
import { linkify } from '@/components/mobile/AssistantContent'
import { ChevronRight, Loader2, MessageSquare } from 'lucide-react'

interface Msg {
  role: string
  text: string
}

const fmtDate = (key: string) => {
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

const sessionLabel = (key: string, todayKey: string) => {
  if (key === todayKey) return `Today · ${fmtDate(key)}`
  const weekday = new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
  return `${weekday} · ${fmtDate(key)}`
}

const todayKey = () => {
  const off = new Date().getTimezoneOffset() * 60000
  return new Date(Date.now() - off).toISOString().slice(0, 10)
}

function SessionRow({ date, count, today }: { date: string; count: number; today: string }) {
  const paneLink = usePaneLink(`/assistant/sessions/${date}`)
  return (
    <li>
      <Link {...paneLink} className="flex items-center gap-3 px-4 py-3.5 active:bg-[hsl(var(--color-surface-hover))]">
        <MessageSquare className="w-4 h-4 shrink-0 text-[hsl(var(--color-primary))]" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[hsl(var(--color-text-primary))] truncate">
            {sessionLabel(date, today)}
          </p>
          <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5">
            {count} message{count === 1 ? '' : 's'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
      </Link>
    </li>
  )
}

/** Past assistant sessions — one per day, newest first. */
export function AssistantSessions() {
  const [sessions, setSessions] = useState<{ date: string; count: number }[] | null>(null)
  const [today] = useState(todayKey)

  useEffect(() => {
    getAssistantSessions(new Date().getTimezoneOffset()).then(r => setSessions(r.sessions))
  }, [])

  return (
    <div>
      <MobileBackHeader title="Sessions" />
      {sessions === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-8 text-center">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">No past sessions yet</p>
        </div>
      ) : (
        <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
          {sessions.map(s => <SessionRow key={s.date} date={s.date} count={s.count} today={today} />)}
        </ul>
      )}
    </div>
  )
}

/** Read-only view of one day's conversation. */
export function AssistantSessionView({ date }: { date: string }) {
  const [messages, setMessages] = useState<Msg[] | null>(null)
  const [title] = useState(() => sessionLabel(date, todayKey()))

  useEffect(() => {
    getAssistantSession(date, new Date().getTimezoneOffset()).then(r => setMessages(r.messages))
  }, [date])

  return (
    <div>
      <MobileBackHeader title={title} />
      <div className="space-y-2 py-3">
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
                {linkify(m.text)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
