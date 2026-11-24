'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { getViewAsUser, getViewAsQueues, getViewAsSessions, getViewAsSession, getViewAsAudioUrl } from '@/app/actions/viewas'
import { usePaneLink } from '@/lib/panes'
import { linkify, AudioBubble } from '@/components/mobile/AssistantContent'
import { ChevronLeft, ChevronRight, Loader2, MessageSquare, Zap, AlertTriangle, Eye, LayoutGrid, Bot } from 'lucide-react'

type Tab = 'requests' | 'actions' | 'ai'

const chip = (label: string, cls: string) => (
  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cls}`}>{label}</span>
)

const fmtWhen = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null

function Row({ href, title, subtitle, right, chipEl }: {
  href: string | null
  title: string
  subtitle?: string | null
  right?: string | null
  chipEl?: React.ReactNode
}) {
  const paneLink = usePaneLink(href ?? '/admin/usage')
  const inner = (
    <>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[hsl(var(--color-text-primary))] truncate">{title}</p>
        {subtitle && <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5 truncate">{subtitle}</p>}
      </div>
      {right && <span className="text-[11px] text-[hsl(var(--color-text-muted))] shrink-0">{right}</span>}
      {chipEl}
      {href && <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />}
    </>
  )
  const cls = 'flex items-center gap-3 px-4 py-3'
  return (
    <li>
      {href
        ? <Link {...paneLink} className={`${cls} active:bg-[hsl(var(--color-surface-hover))]`}>{inner}</Link>
        : <div className={cls}>{inner}</div>}
    </li>
  )
}

function Group({ title, icon, accent, children }: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 px-1 flex items-center gap-1.5 ${accent}`}>
        {icon} {title}
      </p>
      <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
        {children}
      </ul>
    </section>
  )
}

function RequestsTab({ data }: { data: any }) {
  const r = data?.requests
  if (!r) return null
  const empty = !r.to_answer?.length && !r.answered_awaiting_seen?.length && !r.tasks?.length
  if (empty) return <p className="text-sm text-[hsl(var(--color-text-muted))] text-center py-10">Nothing in their requests queue</p>
  return (
    <div>
      {!!r.to_answer?.length && (
        <Group title="Requests to answer" icon={<MessageSquare className="w-3.5 h-3.5" />} accent="text-blue-400">
          {r.to_answer.map((q: any, i: number) => (
            <Row
              key={i}
              href={`/cases/${q.case_id}/progress`}
              title={q.about || 'Request'}
              subtitle={[q.case, q.step].filter(Boolean).join(' · ')}
              right={fmtWhen(q.waiting_since)}
              chipEl={q.late ? chip('Late', 'bg-red-400/10 text-red-400') : chip('New', 'bg-blue-400/10 text-blue-400')}
            />
          ))}
        </Group>
      )}
      {!!r.answered_awaiting_seen?.length && (
        <Group title="Answered — awaiting their review" icon={<MessageSquare className="w-3.5 h-3.5" />} accent="text-amber-400">
          {r.answered_awaiting_seen.map((q: any, i: number) => (
            <Row
              key={i}
              href={`/cases/${q.case_id}/progress`}
              title={q.about || 'Request'}
              subtitle={[q.case, q.step].filter(Boolean).join(' · ')}
              right={fmtWhen(q.answered_at)}
              chipEl={chip('Review', 'bg-amber-400/10 text-amber-400')}
            />
          ))}
        </Group>
      )}
      {!!r.tasks?.length && (
        <Group title="Board tasks" icon={<LayoutGrid className="w-3.5 h-3.5" />} accent="text-violet-400">
          {r.tasks.map((t: any, i: number) => (
            <Row
              key={i}
              href={`/board/${t.board_id}`}
              title={t.title}
              subtitle={[t.board, t.column].filter(Boolean).join(' · ')}
              right={fmtWhen(t.due)}
              chipEl={t.late ? chip('Late', 'bg-red-400/10 text-red-400') : undefined}
            />
          ))}
        </Group>
      )}
    </div>
  )
}

function ActionsTab({ data }: { data: any }) {
  const a = data?.actions
  if (!a) return null
  const empty = !a.late?.length && !a.upcoming?.length && !a.undated?.length && !a.neglected_cases?.length
  if (empty) return <p className="text-sm text-[hsl(var(--color-text-muted))] text-center py-10">Nothing in their actions queue</p>
  const actionRow = (x: any, i: number, chipEl?: React.ReactNode) => (
    <Row
      key={i}
      href={x.case_id ? `/cases/${x.case_id}/progress` : null}
      title={x.what}
      subtitle={[x.case, x.waiting_on ? `waiting on ${x.waiting_on}` : null].filter(Boolean).join(' · ')}
      right={fmtWhen(x.due)}
      chipEl={chipEl}
    />
  )
  return (
    <div>
      {!!a.late?.length && (
        <Group title="Late" icon={<Zap className="w-3.5 h-3.5" />} accent="text-red-400">
          {a.late.map((x: any, i: number) => actionRow(x, i, chip('Late', 'bg-red-400/10 text-red-400')))}
        </Group>
      )}
      {!!a.upcoming?.length && (
        <Group title="Upcoming" icon={<Zap className="w-3.5 h-3.5" />} accent="text-orange-400">
          {a.upcoming.map((x: any, i: number) => actionRow(x, i, chip('Due', 'bg-orange-400/10 text-orange-400')))}
        </Group>
      )}
      {!!a.undated?.length && (
        <Group title="No date" icon={<Zap className="w-3.5 h-3.5" />} accent="text-[hsl(var(--color-text-muted))]">
          {a.undated.map((x: any, i: number) => actionRow(x, i))}
        </Group>
      )}
      {!!a.neglected_cases?.length && (
        <Group title="Neglected cases" icon={<AlertTriangle className="w-3.5 h-3.5" />} accent="text-amber-400">
          {a.neglected_cases.map((x: any, i: number) => (
            <Row
              key={i}
              href={`/cases/${x.case_id}/progress`}
              title={x.case}
              subtitle={x.step}
              chipEl={chip('Neglected', 'bg-amber-400/10 text-amber-400')}
            />
          ))}
        </Group>
      )}
    </div>
  )
}

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
    return <p className="text-sm text-[hsl(var(--color-text-muted))] text-center py-10">No assistant sessions yet</p>
  }
  return (
    <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
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
  const [queues, setQueues] = useState<{ requests: any; actions: any } | null>(null)
  const [tab, setTab] = useState<Tab>('requests')

  useEffect(() => {
    getViewAsUser(userId).then(setUser)
    getViewAsQueues(userId).then(setQueues)
  }, [userId])

  const tabs: { id: Tab; label: string }[] = [
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
        Their queues exactly as they see them — nothing here can be changed.
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

      {tab !== 'ai' && queues === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--color-text-secondary))]" />
        </div>
      ) : tab === 'requests' ? (
        <RequestsTab data={queues} />
      ) : tab === 'actions' ? (
        <ActionsTab data={queues} />
      ) : (
        <AiTab userId={userId} />
      )}
    </div>
  )
}
