'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { searchClients, type ClientSearchResult } from '@/app/actions/search'
import { getMyOpenTasks, getCurrentUser } from '@/app/actions/dashboard'
import { getMyOpenActions, getMyQueries, getCasesMissingActions } from '@/app/actions/workflow'
import { getRecentClients, type RecentClient } from '@/lib/recent-clients'
import { usePaneNavigate } from '@/lib/panes'
import {
  Search,
  ListChecks,
  CalendarClock,
  Phone,
  Clock,
  ChevronRight,
  Plus,
} from 'lucide-react'

const DAY_MS = 86400000
const DEADLINE_RANGES = [7, 30, 90] as const
type DeadlineRange = typeof DEADLINE_RANGES[number]

export default function MobileHomePage() {
  const router = useRouter()
  const paneNav = usePaneNavigate()

  /** On desktop opens href as a pane; otherwise navigates normally. */
  const go = (href: string) => {
    if (!paneNav(href)) router.push(href)
  }

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [userName, setUserName] = useState<string | null>(null)
  const [newTasks, setNewTasks] = useState<number | null>(null)
  const [lateTasks, setLateTasks] = useState<number | null>(null)
  const [deadlineRange, setDeadlineRange] = useState<DeadlineRange>(7)
  const [deadlineCounts, setDeadlineCounts] = useState<Record<DeadlineRange, number> | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [neglectedCount, setNeglectedCount] = useState<number | null>(null)
  const [recentClients, setRecentClients] = useState<RecentClient[]>([])

  // Load counts + user name once
  useEffect(() => {
    setRecentClients(getRecentClients())

    getCurrentUser().then(({ user }) => {
      setUserName(user?.display_name || user?.email || null)
    })

    Promise.all([getMyOpenTasks(), getMyQueries()]).then(([{ tasks }, { queries }]) => {
      const cutoff = Date.now() - DAY_MS
      const all = [...tasks.map(t => t.created_at), ...queries.map(q => q.created_at)]
      setNewTasks(all.filter(d => new Date(d).getTime() >= cutoff).length)
      setLateTasks(all.filter(d => new Date(d).getTime() < cutoff).length)
    })

    getCasesMissingActions().then(({ cases }) => setNeglectedCount(cases.length))

    getMyOpenActions().then(({ actions }) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayMs = today.getTime()

      const withDates = actions.filter(a => a.due_date)
      setOverdueCount(withDates.filter(a => new Date(a.due_date!).getTime() < todayMs).length)
      setDeadlineCounts({
        7: withDates.filter(a => { const d = new Date(a.due_date!).getTime(); return d >= todayMs && d <= todayMs + 7 * DAY_MS }).length,
        30: withDates.filter(a => { const d = new Date(a.due_date!).getTime(); return d >= todayMs && d <= todayMs + 30 * DAY_MS }).length,
        90: withDates.filter(a => { const d = new Date(a.due_date!).getTime(); return d >= todayMs && d <= todayMs + 90 * DAY_MS }).length,
      })
    })
  }, [])

  // Debounced quick search — top 5 results in a floating dropdown
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    setDropdownOpen(true)
    debounceRef.current = setTimeout(async () => {
      const { results } = await searchClients(q, 5)
      setResults(results)
      setSearching(false)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const fullName = (c: ClientSearchResult) =>
    [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'

  const goToFullSearch = () => {
    setDropdownOpen(false)
    go(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="space-y-4">
      {userName && (
        <p className="text-sm text-[hsl(var(--color-text-secondary))]">
          Hello, <span className="text-[hsl(var(--color-text-primary))] font-medium">{userName}</span>
        </p>
      )}

      {/* Search panel — results float in a dropdown so the panel never grows */}
      <section className="relative bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-[hsl(var(--color-primary))]" />
          <h2 className="font-semibold text-[hsl(var(--color-text-primary))] flex-1">Find a client</h2>
          <Link
            href="/clients?add=1"
            className="flex items-center gap-1 px-3 h-8 rounded-lg bg-[hsl(var(--color-primary))] text-white text-xs font-semibold active:bg-[hsl(var(--color-primary-hover))] shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add client
          </Link>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setDropdownOpen(true)}
          placeholder="First name, last name, or phone…"
          className="w-full h-11 px-4 rounded-xl bg-[hsl(var(--color-surface-secondary))] border border-[hsl(var(--color-border))] text-[15px] text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none focus:border-[hsl(var(--color-border-hover))]"
        />

        {/* Floating dropdown */}
        {dropdownOpen && query.trim().length >= 2 && (
          <>
            {/* Invisible backdrop to close on tap outside */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute left-4 right-4 top-full -mt-1 z-50 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
              {searching && results.length === 0 ? (
                <p className="text-sm text-[hsl(var(--color-text-secondary))] px-4 py-3">Searching…</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-[hsl(var(--color-text-secondary))] px-4 py-3">No clients found</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto divide-y divide-[hsl(var(--color-border))]">
                  {results.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/clients/${c.id}`}
                        className="flex items-center gap-3 px-4 py-3 active:bg-[hsl(var(--color-surface-hover))]"
                      >
                        <div className="w-9 h-9 rounded-full bg-[hsl(var(--color-surface-active))] flex items-center justify-center text-sm font-semibold text-[hsl(var(--color-text-primary))] shrink-0">
                          {(c.first_name?.[0] || c.last_name?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-medium text-[hsl(var(--color-text-primary))] truncate">
                            {fullName(c)}
                          </p>
                          {c.phones[0] && (
                            <p className="text-xs text-[hsl(var(--color-text-secondary))] flex items-center gap-1 truncate">
                              <Phone className="w-3 h-3 shrink-0" />
                              {c.phones[0]}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={goToFullSearch}
                className="w-full h-11 bg-[hsl(var(--color-primary))] text-white text-[15px] font-medium active:bg-[hsl(var(--color-primary-hover))]"
              >
                View all results
              </button>
            </div>
          </>
        )}
      </section>

      {/* Requests + Actions — one row each */}
      <div className="space-y-3">
        {/* Requests — New = created in last 24h, Late = open for over 24h */}
        <div
          role="button"
          onClick={() => go('/requests')}
          className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-4 active:bg-[hsl(var(--color-surface-hover))] cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
              <ListChecks className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-base font-semibold text-[hsl(var(--color-text-primary))] flex-1">Requests</p>
            <ChevronRight className="w-5 h-5 text-[hsl(var(--color-text-muted))]" />
          </div>
          <div className="grid grid-cols-2 text-center mt-4">
            <div className="border-r border-[hsl(var(--color-border))]">
              <p className={`text-4xl font-bold ${newTasks ? 'text-blue-400' : 'text-[hsl(var(--color-text-primary))]'}`}>
                {newTasks ?? '–'}
              </p>
              <p className="text-xs text-[hsl(var(--color-text-muted))] mt-1.5">New</p>
            </div>
            <div>
              <p className={`text-4xl font-bold ${lateTasks ? 'text-red-400' : 'text-[hsl(var(--color-text-primary))]'}`}>
                {lateTasks ?? '–'}
              </p>
              <p className="text-xs text-[hsl(var(--color-text-muted))] mt-1.5">Late</p>
            </div>
          </div>
        </div>

        {/* Actions — upcoming due dates within the selected range */}
        <div
          role="button"
          onClick={() => go('/actions')}
          className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-4 active:bg-[hsl(var(--color-surface-hover))] cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-base font-semibold text-[hsl(var(--color-text-primary))] flex-1">Actions</p>
            <div className="flex rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-secondary))] p-0.5 shrink-0">
              {DEADLINE_RANGES.map(r => (
                <button
                  key={r}
                  onClick={(e) => { e.stopPropagation(); setDeadlineRange(r) }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    deadlineRange === r
                      ? 'bg-white text-black'
                      : 'text-[hsl(var(--color-text-muted))]'
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 text-center mt-4">
            <div className="border-r border-[hsl(var(--color-border))]">
              <p className={`text-4xl font-bold ${deadlineCounts?.[deadlineRange] ? 'text-blue-400' : 'text-[hsl(var(--color-text-primary))]'}`}>
                {deadlineCounts?.[deadlineRange] ?? '–'}
              </p>
              <p className="text-xs text-[hsl(var(--color-text-muted))] mt-1.5">Upcoming</p>
            </div>
            <div className="border-r border-[hsl(var(--color-border))]">
              <p className={`text-4xl font-bold ${overdueCount ? 'text-red-400' : 'text-[hsl(var(--color-text-primary))]'}`}>
                {overdueCount}
              </p>
              <p className="text-xs text-[hsl(var(--color-text-muted))] mt-1.5">Late</p>
            </div>
            <div>
              <p className={`text-4xl font-bold ${neglectedCount ? 'text-amber-400' : 'text-[hsl(var(--color-text-primary))]'}`}>
                {neglectedCount ?? '–'}
              </p>
              <p className="text-xs text-[hsl(var(--color-text-muted))] mt-1.5">Neglected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent clients */}
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <Clock className="w-4 h-4 text-[hsl(var(--color-text-muted))]" />
          <h3 className="text-sm font-semibold text-[hsl(var(--color-text-secondary))]">Recent clients</h3>
        </div>

        {recentClients.length === 0 ? (
          <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-4">
            <p className="text-xs text-[hsl(var(--color-text-muted))]">
              Clients you open will appear here for quick access
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {recentClients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex flex-col items-center active:opacity-70"
              >
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--color-surface-active))] border border-[hsl(var(--color-border))] flex items-center justify-center text-base font-semibold text-[hsl(var(--color-text-primary))]">
                  {c.name[0]?.toUpperCase() || '?'}
                </div>
                <p className="text-[11px] text-[hsl(var(--color-text-secondary))] mt-1.5 truncate w-full text-center">
                  {c.name.split(' ')[0]}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
