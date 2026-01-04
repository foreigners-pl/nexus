'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useWeeklyCache } from '@/lib/query'
import { cn } from '@/lib/utils'
import {
  getWeeklyCases,
  getWeeklyCards,
  getWeeklyPayments
} from '@/app/actions/dashboard'

type TabType = 'timeline' | 'cases' | 'tasks' | 'payments' | 'overdue'

// Helper functions
function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    dates.push(date)
  }
  return dates
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Format date as YYYY-MM-DD in local timezone (not UTC)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateRange(startDate: Date): string {
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' })
  if (startMonth === endMonth) {
    return `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}, ${startDate.getFullYear()}`
  }
  return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${startDate.getFullYear()}`
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function isPast(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

function formatDueDate(dateString: string | null): string {
  if (!dateString) return 'No date'
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `In ${diffDays} days`
  return date.toLocaleDateString()
}

// ============================================
// MAIN COMPONENT - Receives data as props
// ============================================

interface DashboardPanelProps {
  myCases: any[]
  myTasks: any[]
  myPayments: any[]
  myOverdue: { cases: any[]; tasks: any[]; payments: any[] }
  todayCount: number
  todayCounts: { cases: number; tasks: number; payments: number }
}

export function DashboardPanel({ myCases, myTasks, myPayments, myOverdue, todayCount, todayCounts }: DashboardPanelProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('timeline')

  // Calculate counts from actual data
  const overdueTotal = myOverdue.cases.length + myOverdue.tasks.length + myOverdue.payments.length
  const pendingTotal = myPayments.reduce((sum, c) => sum + (c.total_price - c.total_paid), 0)

  // Tab configuration with colors
  const tabConfig = [
    { 
      id: 'timeline' as TabType, 
      label: 'Today', 
      count: todayCount, 
      colorClass: 'text-cyan-400', 
      bgClass: 'bg-cyan-400/20',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      id: 'cases' as TabType, 
      label: 'My Cases', 
      count: myCases.length, 
      colorClass: 'text-blue-400', 
      bgClass: 'bg-blue-400/20',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    { 
      id: 'tasks' as TabType, 
      label: 'Open Tasks', 
      count: myTasks.length, 
      colorClass: 'text-purple-400', 
      bgClass: 'bg-purple-400/20',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    { 
      id: 'payments' as TabType, 
      label: 'Pending', 
      count: pendingTotal > 0 ? `${pendingTotal.toLocaleString()} PLN` : '0 PLN', 
      colorClass: 'text-green-400', 
      bgClass: 'bg-green-400/20',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      id: 'overdue' as TabType, 
      label: 'Overdue', 
      count: overdueTotal, 
      colorClass: 'text-red-400', 
      bgClass: 'bg-red-400/20',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    }
  ]

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-2 pt-3 px-3">
        {/* Main Tabs - Glass Card Style */}
        <div className="flex gap-2">
          {tabConfig.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 cursor-pointer",
                "border backdrop-blur-sm",
                activeTab === tab.id
                  ? [
                      "border-[hsl(var(--color-border-hover))] bg-[hsl(var(--color-surface-hover))]",
                      "shadow-[0_4px_20px_rgb(0_0_0/0.25),inset_0_1px_0_rgb(255_255_255/0.05)]",
                      "scale-[1.02]"
                    ]
                  : [
                      "border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]",
                      "hover:border-[hsl(var(--color-border-hover))] hover:bg-[hsl(var(--color-surface-hover))]",
                      "hover:shadow-[0_4px_16px_rgb(0_0_0/0.15)]",
                      "hover:scale-[1.01]"
                    ]
              )}
            >
              {/* Icon with colored background */}
              <div className={cn(
                "p-2 rounded-lg transition-all duration-300",
                tab.bgClass,
                activeTab === tab.id && "shadow-[0_0_12px_currentColor/0.3]"
              )}>
                <div className={tab.colorClass}>
                  {tab.icon}
                </div>
              </div>
              {/* Label and count */}
              <div className="text-left">
                <div className="text-xs text-[hsl(var(--color-text-secondary))]">{tab.label}</div>
                {tab.count !== null && (
                  <div className={cn(
                    "text-base font-bold transition-all duration-300",
                    tab.colorClass,
                    activeTab === tab.id && "drop-shadow-[0_0_8px_currentColor]"
                  )}>{tab.count}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-hidden pt-0 px-3 pb-3">
        {activeTab === 'timeline' && <TimelineTab todayCounts={todayCounts} />}
        {activeTab === 'cases' && <MyCasesTab cases={myCases} />}
        {activeTab === 'tasks' && <OpenTasksTab tasks={myTasks} />}
        {activeTab === 'payments' && <PendingPaymentsTab cases={myPayments} />}
        {activeTab === 'overdue' && <OverdueTab items={myOverdue} />}
      </CardContent>
    </Card>
  )
}

// ============================================
// TIMELINE TAB
// ============================================

interface TimelineItem {
  id: string
  title: string
  subtitle: string
  due_date: string
  type: 'cases' | 'tasks' | 'payments'
  entityId: string
  boardId?: string
  color?: string
}

function TimelineTab({ todayCounts }: { todayCounts: { cases: number; tasks: number; payments: number } }) {
  const router = useRouter()
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getStartOfWeek(new Date()))
  const [timelineFilter, setTimelineFilter] = useState<'cases' | 'tasks' | 'payments'>('cases')
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  const weekStartStr = formatLocalDate(currentWeekStart)
  const { getCachedCases, getCachedTasks, getCachedPayments, setCachedCases, setCachedTasks, setCachedPayments } = useWeeklyCache(weekStartStr)

  const weekDates = getWeekDates(currentWeekStart)

  // Transform raw data to TimelineItem format
  const transformCases = (cases: Awaited<ReturnType<typeof getWeeklyCases>>['cases']): TimelineItem[] => {
    return cases.map(c => {
      const client = Array.isArray(c.clients) ? c.clients[0] : c.clients
      return {
        id: c.id,
        title: c.case_code || 'Unknown Case',
        subtitle: client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : 'Unknown',
        due_date: c.due_date || '',
        type: 'cases' as const,
        entityId: c.id
      }
    })
  }

  const transformTasks = (cards: Awaited<ReturnType<typeof getWeeklyCards>>['cards']): TimelineItem[] => {
    return cards.map(c => {
      const board = Array.isArray(c.boards) ? c.boards[0] : c.boards
      const status = Array.isArray(c.board_statuses) ? c.board_statuses[0] : c.board_statuses
      return {
        id: c.id,
        title: c.title,
        subtitle: board?.name || 'Unknown Board',
        due_date: c.due_date || '',
        type: 'tasks' as const,
        entityId: c.id,
        boardId: c.board_id,
        color: status?.color
      }
    })
  }

  const transformPayments = (payments: Awaited<ReturnType<typeof getWeeklyPayments>>['payments']): TimelineItem[] => {
    return payments.map(p => {
      const caseData = Array.isArray(p.cases) ? p.cases[0] : p.cases
      const client = caseData?.clients ? (Array.isArray(caseData.clients) ? caseData.clients[0] : caseData.clients) : null
      return {
        id: p.id,
        title: `${p.amount.toLocaleString()} PLN`,
        subtitle: client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : (caseData?.case_code || 'Unknown'),
        due_date: p.due_date || '',
        type: 'payments' as const,
        entityId: p.case_id
      }
    })
  }

  useEffect(() => {
    loadItems()
  }, [currentWeekStart, timelineFilter])

  async function loadItems() {
    const startDateStr = formatLocalDate(currentWeekStart)
    console.log('[TimelineTab] Loading items for:', startDateStr, 'filter:', timelineFilter)

    // Check cache first for INSTANT display
    if (timelineFilter === 'cases') {
      const cached = getCachedCases()
      if (cached?.cases) {
        console.log('[TimelineTab] Using cached cases:', cached.cases.length)
        setItems(transformCases(cached.cases))
        setLoading(false)
        // Refresh in background
        getWeeklyCases(startDateStr).then((result) => {
          setItems(transformCases(result.cases))
          setCachedCases(result)
        })
        return
      }
    } else if (timelineFilter === 'tasks') {
      const cached = getCachedTasks()
      if (cached?.cards) {
        console.log('[TimelineTab] Using cached tasks:', cached.cards.length)
        setItems(transformTasks(cached.cards))
        setLoading(false)
        // Refresh in background
        getWeeklyCards(startDateStr).then((result) => {
          setItems(transformTasks(result.cards))
          setCachedTasks(result)
        })
        return
      }
    } else {
      const cached = getCachedPayments()
      if (cached?.payments) {
        console.log('[TimelineTab] Using cached payments:', cached.payments.length)
        setItems(transformPayments(cached.payments))
        setLoading(false)
        // Refresh in background
        getWeeklyPayments(startDateStr).then((result) => {
          setItems(transformPayments(result.payments))
          setCachedPayments(result)
        })
        return
      }
    }

    // No cache - show loading and fetch
    setLoading(true)
    let newItems: TimelineItem[] = []

    if (timelineFilter === 'cases') {
      const result = await getWeeklyCases(startDateStr)
      console.log('[TimelineTab] Cases received:', result.cases?.length, 'Error:', result.error)
      newItems = transformCases(result.cases)
      setCachedCases(result)
    } else if (timelineFilter === 'tasks') {
      const result = await getWeeklyCards(startDateStr)
      newItems = transformTasks(result.cards)
      setCachedTasks(result)
    } else {
      const result = await getWeeklyPayments(startDateStr)
      newItems = transformPayments(result.payments)
      setCachedPayments(result)
    }

    console.log('[TimelineTab] Items loaded:', newItems.length)
    setItems(newItems)
    setLoading(false)
  }

  const itemsByDate: Record<string, TimelineItem[]> = {}
  items.forEach(item => {
    const dateKey = item.due_date.split('T')[0]
    if (!itemsByDate[dateKey]) itemsByDate[dateKey] = []
    itemsByDate[dateKey].push(item)
  })

  const handleItemClick = (item: TimelineItem) => {
    if (item.type === 'cases' || item.type === 'payments') {
      router.push(`/cases/${item.entityId}`)
    } else if (item.type === 'tasks' && item.boardId) {
      router.push(`/board/${item.boardId}?cardId=${item.entityId}`)
    } else {
      router.push('/board')
    }
  }

  const filterButtons = [
    { id: 'cases' as const, label: 'Cases', count: todayCounts.cases, color: 'blue' },
    { id: 'tasks' as const, label: 'Tasks', count: todayCounts.tasks, color: 'purple' },
    { id: 'payments' as const, label: 'Payments', count: todayCounts.payments, color: 'green' }
  ]

  const filterColors = {
    cases: { active: 'bg-blue-500 shadow-[0_2px_12px_rgb(59_130_246/0.4)]', badge: 'bg-blue-500', badgeActive: 'bg-white/20' },
    tasks: { active: 'bg-purple-500 shadow-[0_2px_12px_rgb(168_85_247/0.4)]', badge: 'bg-purple-500', badgeActive: 'bg-white/20' },
    payments: { active: 'bg-green-500 shadow-[0_2px_12px_rgb(34_197_94/0.4)]', badge: 'bg-green-500', badgeActive: 'bg-white/20' }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Navigation + Filter Row */}
      <div className="flex items-center justify-between pb-3 gap-4">
        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => {
            const newStart = new Date(currentWeekStart)
            newStart.setDate(newStart.getDate() - 7)
            setCurrentWeekStart(newStart)
          }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <span className="font-medium text-[hsl(var(--color-text-primary))] text-sm min-w-[180px] text-center">
            {formatDateRange(currentWeekStart)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => {
            const newStart = new Date(currentWeekStart)
            newStart.setDate(newStart.getDate() + 7)
            setCurrentWeekStart(newStart)
          }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))} className="text-xs ml-1">
            Today
          </Button>
        </div>

        {/* Filter Buttons - Glass Style with Colors */}
        <div className="flex gap-1 bg-[hsl(var(--color-surface))] backdrop-blur-sm p-1 rounded-xl border border-[hsl(var(--color-border))]">
          {filterButtons.map(f => (
            <button
              key={f.id}
              onClick={() => setTimelineFilter(f.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 cursor-pointer",
                timelineFilter === f.id
                  ? `${filterColors[f.id].active} text-white`
                  : "text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-hover))]"
              )}
            >
              {f.label}
              {f.count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 text-xs font-bold rounded-full",
                  timelineFilter === f.id ? filterColors[f.id].badgeActive + " text-white" : filterColors[f.id].badge + " text-white"
                )}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-[hsl(var(--color-primary))] border-t-transparent rounded-full animate-spin" />
              <div className="text-sm text-[hsl(var(--color-text-secondary))]">Loading timeline...</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2 h-full min-w-[600px]">
            {weekDates.map((date) => {
              const dateKey = formatLocalDate(date)
              const dayItems = itemsByDate[dateKey] || []
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
              const dayNum = date.getDate()
              const today = isToday(date)
              const past = isPast(date)

              return (
                <div 
                  key={dateKey} 
                  className={cn(
                    "flex flex-col rounded-xl border backdrop-blur-sm transition-all duration-300 min-w-0 flex-1",
                    today 
                      ? "border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary))]/10 shadow-[0_0_20px_hsl(var(--color-primary)/0.15)]" 
                      : "border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-secondary))] hover:bg-[hsl(var(--color-surface))]"
                  )}
                >
                  <div className={cn(
                    "px-2 py-3 text-center border-b h-[72px] flex flex-col justify-center",
                    today ? "border-[hsl(var(--color-primary))]/30" : "border-[hsl(var(--color-border))]"
                  )}>
                    <div className={cn(
                      "text-xs font-medium",
                      today ? "text-[hsl(var(--color-text-primary))]" : "text-[hsl(var(--color-text-secondary))]"
                    )}>
                      {dayName}
                    </div>
                    <div className={cn(
                      "font-bold",
                      today ? "text-2xl text-[hsl(var(--color-text-primary))]" : "text-lg",
                      !today && (past ? "text-[hsl(var(--color-text-secondary))]" : "text-[hsl(var(--color-text-primary))]")
                    )}>
                      {dayNum}
                    </div>
                  </div>
                  <div className="flex-1 p-1 space-y-1 overflow-y-auto scrollbar-thin">
                    {dayItems.length === 0 ? (
                      <div className="text-xs text-[hsl(var(--color-text-secondary))] text-center py-4"></div>
                    ) : (
                      dayItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            "p-2 rounded-lg text-xs cursor-pointer transition-all duration-200 border",
                            "hover:scale-[1.02] hover:shadow-[0_4px_12px_rgb(0_0_0/0.3)]",
                            past && !today
                              ? "bg-red-900/50 hover:bg-red-900/70 border-red-500/40"
                              : today
                                ? "bg-[hsl(var(--color-surface))] hover:bg-[hsl(var(--color-surface-active))] border-[hsl(var(--color-border-hover))]"
                                : "bg-[hsl(var(--color-surface-hover))] hover:bg-[hsl(var(--color-surface-active))] border-[hsl(var(--color-border))]"
                          )}
                        >
                          <div className={cn("font-semibold truncate", past && !today ? "text-red-300" : "text-white")}>
                            {item.title}
                          </div>
                          <div className={cn("truncate", past && !today ? "text-red-300/70" : "text-gray-300")}>{item.subtitle}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// MY CASES TAB
// ============================================

function MyCasesTab({ cases }: { cases: any[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filteredCases = search 
    ? cases.filter(c => {
        const clientName = [c.clients?.first_name, c.clients?.last_name].filter(Boolean).join(' ').toLowerCase()
        const caseCode = (c.case_code || '').toLowerCase()
        return clientName.includes(search.toLowerCase()) || caseCode.includes(search.toLowerCase())
      })
    : cases

  return (
    <div className="h-full flex flex-col">
      <div className="pb-3">
        <Input
          placeholder="Search cases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-2">
        {filteredCases.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">
            {search ? 'No cases match your search' : 'No cases assigned to you'}
          </div>
        ) : (
          filteredCases.map(c => {
            const clientName = [c.clients?.first_name, c.clients?.last_name].filter(Boolean).join(' ')
            const statusColor = c.status?.color || '#888'
            
            return (
              <div
                key={c.id}
                onClick={() => router.push(`/cases/${c.id}`)}
                className="p-3 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] backdrop-blur-sm hover:bg-[hsl(var(--color-surface-hover))] cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_4px_16px_rgb(0_0_0/0.2)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[hsl(var(--color-text-primary))]">{c.case_code || 'No code'}</span>
                      <span 
                        className="px-2 py-0.5 text-xs rounded-full text-white"
                        style={{ backgroundColor: statusColor }}
                      >
                        {c.status?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="text-sm text-[hsl(var(--color-text-secondary))]">{clientName || 'Unknown client'}</div>
                  </div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {c.due_date ? formatDueDate(c.due_date) : 'No due date'}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ============================================
// OPEN TASKS TAB
// ============================================

function OpenTasksTab({ tasks }: { tasks: any[] }) {
  const router = useRouter()

  // Group by board
  const tasksByBoard: Record<string, any[]> = {}
  tasks.forEach(t => {
    const boardName = t.boards?.name || 'Unknown Board'
    if (!tasksByBoard[boardName]) tasksByBoard[boardName] = []
    tasksByBoard[boardName].push(t)
  })

  return (
    <div className="h-full overflow-y-auto scrollbar-thin space-y-4">
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--color-text-secondary))]">
          <span className="text-4xl mb-2"></span>
          <span>No open tasks assigned to you!</span>
        </div>
      ) : (
        Object.entries(tasksByBoard).map(([boardName, boardTasks]) => (
          <div key={boardName}>
            <h3 className="text-sm font-semibold text-[hsl(var(--color-text-secondary))] mb-2">{boardName}</h3>
            <div className="space-y-2">
              {boardTasks.map(t => {
                const statusColor = t.board_statuses?.color || '#888'
                const isOverdue = t.due_date && new Date(t.due_date) < new Date()
                
                return (
                  <div
                    key={t.id}
                    onClick={() => router.push(`/board/${t.board_id}?cardId=${t.id}`)}
                    className={cn(
                      "p-3 rounded-xl border cursor-pointer transition-all duration-200 backdrop-blur-sm",
                      "hover:scale-[1.01] hover:shadow-[0_4px_16px_rgb(0_0_0/0.15)]",
                      isOverdue 
                        ? "border-red-500/40 bg-red-500/10 hover:bg-red-500/15"
                        : "border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] hover:bg-[hsl(var(--color-surface-hover))]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: statusColor }}
                          />
                          <span className={cn("font-medium truncate", isOverdue ? "text-red-600" : "text-[hsl(var(--color-text-primary))]")}>
                            {t.title}
                          </span>
                        </div>
                        <div className="text-xs text-[hsl(var(--color-text-secondary))] ml-4">
                          {t.board_statuses?.name || 'No status'}
                        </div>
                      </div>
                      <div className={cn("text-xs", isOverdue ? "text-red-500 font-medium" : "text-[hsl(var(--color-text-secondary))]")}>
                        {formatDueDate(t.due_date)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ============================================
// PENDING PAYMENTS TAB
// ============================================

function PendingPaymentsTab({ cases }: { cases: any[] }) {
  const router = useRouter()

  return (
    <div className="h-full overflow-y-auto scrollbar-thin space-y-3">
      {cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--color-text-secondary))]">
          <span className="text-4xl mb-2"></span>
          <span>No pending payments!</span>
        </div>
      ) : (
        cases.map(c => {
          const nextPayment = c.installments[0]
          const isOverdue = nextPayment?.due_date && new Date(nextPayment.due_date) < new Date()
          
          return (
            <div
              key={c.case_id}
              onClick={() => router.push(`/cases/${c.case_id}`)}
              className={cn(
                "p-3 rounded-xl border cursor-pointer transition-all duration-200 backdrop-blur-sm",
                "hover:scale-[1.01] hover:shadow-[0_4px_16px_rgb(0_0_0/0.15)]",
                isOverdue
                  ? "border-red-500/40 bg-red-500/10 hover:bg-red-500/15"
                  : "border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] hover:bg-[hsl(var(--color-surface-hover))]"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium text-[hsl(var(--color-text-primary))]">{c.case_code || 'No code'}</span>
                  <span className="text-[hsl(var(--color-text-secondary))] text-sm ml-2">{c.client_name}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-[hsl(var(--color-text-secondary))] mb-1">
                  <span>Paid: {c.total_paid.toLocaleString()} PLN</span>
                  <span>Total: {c.total_price.toLocaleString()} PLN</span>
                </div>
                <div className="h-2 bg-[hsl(var(--color-surface-secondary))] rounded-full overflow-hidden backdrop-blur-sm">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgb(34_197_94/0.5)]"
                    style={{ width: `${c.total_price > 0 ? (c.total_paid / c.total_price) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Upcoming payments */}
              <div className="space-y-1">
                {c.installments.slice(0, 3).map((inst: any) => {
                  const instOverdue = inst.due_date && new Date(inst.due_date) < new Date()
                  return (
                    <div key={inst.id} className="flex justify-between text-xs">
                      <span className={cn(instOverdue ? "text-red-500" : "text-[hsl(var(--color-text-secondary))]")}>
                        {inst.label || 'Payment'}: {inst.amount.toLocaleString()} PLN
                      </span>
                      <span className={cn(instOverdue ? "text-red-500 font-medium" : "text-[hsl(var(--color-text-secondary))]")}>
                        {formatDueDate(inst.due_date)}
                      </span>
                    </div>
                  )
                })}
                {c.installments.length > 3 && (
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    +{c.installments.length - 3} more payments
                  </div>
                )}
              </div>

              {/* Unscheduled warning */}
              {c.unscheduled > 0 && (
                <div className="mt-2 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-600">
                   {c.unscheduled.toLocaleString()} PLN unscheduled
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ============================================
// OVERDUE TAB
// ============================================

function OverdueTab({ items }: { items: { cases: any[]; tasks: any[]; payments: any[] } }) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<'cases' | 'tasks' | 'payments'>('cases')

  const totalOverdue = items.cases.length + items.tasks.length + items.payments.length

  if (totalOverdue === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--color-text-secondary))]">
        <span className="text-4xl mb-2"></span>
        <span>Nothing overdue!</span>
      </div>
    )
  }

  const sections = [
    { id: 'cases' as const, label: 'Cases', count: items.cases.length, color: 'blue' },
    { id: 'tasks' as const, label: 'Tasks', count: items.tasks.length, color: 'purple' },
    { id: 'payments' as const, label: 'Payments', count: items.payments.length, color: 'green' }
  ]

  const sectionColors = {
    cases: { active: 'bg-blue-500 shadow-[0_2px_12px_rgb(59_130_246/0.4)]', badge: 'bg-blue-500', badgeActive: 'bg-white/20' },
    tasks: { active: 'bg-purple-500 shadow-[0_2px_12px_rgb(168_85_247/0.4)]', badge: 'bg-purple-500', badgeActive: 'bg-white/20' },
    payments: { active: 'bg-green-500 shadow-[0_2px_12px_rgb(34_197_94/0.4)]', badge: 'bg-green-500', badgeActive: 'bg-white/20' }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Section tabs */}
      <div className="flex gap-1 mb-3 bg-[hsl(var(--color-surface))] backdrop-blur-sm p-1 rounded-xl border border-[hsl(var(--color-border))] w-fit">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 cursor-pointer",
              activeSection === s.id
                ? `${sectionColors[s.id].active} text-white`
                : "text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-hover))]"
            )}
          >
            {s.label}
            {s.count > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 text-xs font-bold rounded-full",
                activeSection === s.id ? sectionColors[s.id].badgeActive + " text-white" : sectionColors[s.id].badge + " text-white"
              )}>
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-2">
        {activeSection === 'cases' && (
          items.cases.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">No overdue cases</div>
          ) : (
            items.cases.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`/cases/${c.id}`)}
                className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 backdrop-blur-sm hover:bg-red-500/15 cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_4px_16px_rgb(239_68_68/0.2)]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-red-600">{c.case_code || 'No code'}</span>
                    <span className="text-[hsl(var(--color-text-secondary))] text-sm ml-2">{c.client_name}</span>
                  </div>
                  <span className="text-xs text-red-500 font-medium">{c.days_overdue}d overdue</span>
                </div>
              </div>
            ))
          )
        )}

        {activeSection === 'tasks' && (
          items.tasks.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">No overdue tasks</div>
          ) : (
            items.tasks.map(t => (
              <div
                key={t.id}
                onClick={() => router.push(`/board/${t.board_id}?cardId=${t.id}`)}
                className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 backdrop-blur-sm hover:bg-red-500/15 cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_4px_16px_rgb(239_68_68/0.2)]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-red-600">{t.title}</span>
                    <span className="text-[hsl(var(--color-text-secondary))] text-sm ml-2">{t.board_name}</span>
                  </div>
                  <span className="text-xs text-red-500 font-medium">{t.days_overdue}d overdue</span>
                </div>
              </div>
            ))
          )
        )}

        {activeSection === 'payments' && (
          items.payments.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">No overdue payments</div>
          ) : (
            items.payments.map(p => (
              <div
                key={p.id}
                onClick={() => router.push(`/cases/${p.case_id}`)}
                className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 backdrop-blur-sm hover:bg-red-500/15 cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_4px_16px_rgb(239_68_68/0.2)]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-red-600">{p.amount.toLocaleString()} PLN</span>
                    <span className="text-[hsl(var(--color-text-secondary))] text-sm ml-2">{p.client_name}</span>
                    {p.case_code && <span className="text-xs text-[hsl(var(--color-text-secondary))] ml-2">({p.case_code})</span>}
                  </div>
                  <span className="text-xs text-red-500 font-medium">{p.days_overdue}d overdue</span>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}
