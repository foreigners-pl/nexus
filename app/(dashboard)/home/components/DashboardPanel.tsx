'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
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

  // DEBUG: Log what data we receive
  console.log('[DashboardPanel] myCases received:', myCases)
  console.log('[DashboardPanel] myCases.length:', myCases.length)

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
      label: 'Cases', 
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
      label: 'Tasks', 
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
      label: 'Payments', 
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
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'cases' | 'tasks' | 'payments'>('all')
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

  // CRITICAL: Check cache SYNCHRONOUSLY before first paint
  // This prevents the loading spinner from appearing when we have cached data
  useLayoutEffect(() => {
    if (timelineFilter === 'all') {
      const cachedCases = getCachedCases()
      const cachedTasks = getCachedTasks()
      const cachedPayments = getCachedPayments()
      if (cachedCases?.cases || cachedTasks?.cards || cachedPayments?.payments) {
        const allItems = [
          ...transformCases(cachedCases?.cases || []),
          ...transformTasks(cachedTasks?.cards || []),
          ...transformPayments(cachedPayments?.payments || [])
        ]
        setItems(allItems)
        setLoading(false)
        return
      }
    } else if (timelineFilter === 'cases') {
      const cached = getCachedCases()
      if (cached?.cases) {
        setItems(transformCases(cached.cases))
        setLoading(false)
        return
      }
    } else if (timelineFilter === 'tasks') {
      const cached = getCachedTasks()
      if (cached?.cards) {
        setItems(transformTasks(cached.cards))
        setLoading(false)
        return
      }
    } else {
      const cached = getCachedPayments()
      if (cached?.payments) {
        setItems(transformPayments(cached.payments))
        setLoading(false)
        return
      }
    }
    // No cache - keep loading true
    setLoading(true)
    setItems([])
  }, [currentWeekStart, timelineFilter])

  // Background refresh after layout effect
  useEffect(() => {
    loadItems()
  }, [currentWeekStart, timelineFilter])

  async function loadItems() {
    const startDateStr = formatLocalDate(currentWeekStart)
    console.log('[TimelineTab] Loading items for:', startDateStr, 'filter:', timelineFilter)

    // Check if we have cached data (set by useLayoutEffect)
    const hadCachedCases = getCachedCases()?.cases
    const hadCachedTasks = getCachedTasks()?.cards
    const hadCachedPayments = getCachedPayments()?.payments
    
    if (timelineFilter === 'all') {
      // Load all three types
      const [casesResult, tasksResult, paymentsResult] = await Promise.all([
        getWeeklyCases(startDateStr),
        getWeeklyCards(startDateStr),
        getWeeklyPayments(startDateStr)
      ])
      
      setCachedCases(casesResult)
      setCachedTasks(tasksResult)
      setCachedPayments(paymentsResult)
      
      const allItems = [
        ...transformCases(casesResult.cases),
        ...transformTasks(tasksResult.cards),
        ...transformPayments(paymentsResult.payments)
      ]
      setItems(allItems)
      setLoading(false)
    } else if (timelineFilter === 'cases') {
      const result = await getWeeklyCases(startDateStr)
      setItems(transformCases(result.cases))
      setCachedCases(result)
      setLoading(false)
    } else if (timelineFilter === 'tasks') {
      const result = await getWeeklyCards(startDateStr)
      setItems(transformTasks(result.cards))
      setCachedTasks(result)
      setLoading(false)
    } else {
      const result = await getWeeklyPayments(startDateStr)
      setItems(transformPayments(result.payments))
      setCachedPayments(result)
      setLoading(false)
    }
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
    { id: 'all' as const, label: 'All', count: todayCounts.cases + todayCounts.tasks + todayCounts.payments, color: 'cyan' },
    { id: 'cases' as const, label: 'Cases', count: todayCounts.cases, color: 'blue' },
    { id: 'tasks' as const, label: 'Tasks', count: todayCounts.tasks, color: 'purple' },
    { id: 'payments' as const, label: 'Payments', count: todayCounts.payments, color: 'green' }
  ]

  const filterColors = {
    all: { active: 'bg-cyan-500 shadow-[0_2px_12px_rgb(6_182_212/0.4)]', badge: 'bg-cyan-500', badgeActive: 'bg-white/20' },
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
          // Show skeleton calendar structure instead of spinner - feels more responsive
          <div className="grid grid-cols-7 gap-2 h-full min-w-[600px]">
            {weekDates.map((date) => {
              const dateKey = formatLocalDate(date)
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
                    {/* Skeleton loading pulses */}
                    <div className="h-7 bg-[hsl(var(--color-surface))] rounded animate-pulse opacity-30" />
                    <div className="h-7 bg-[hsl(var(--color-surface))] rounded animate-pulse opacity-20" />
                  </div>
                </div>
              )
            })}
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
                      dayItems.map(item => {
                        const typeColors = {
                          cases: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', hoverBg: 'hover:bg-blue-500/30' },
                          tasks: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300', hoverBg: 'hover:bg-purple-500/30' },
                          payments: { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-300', hoverBg: 'hover:bg-green-500/30' }
                        }
                        const colors = typeColors[item.type]
                        const isOverdue = past && !today
                        
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className={cn(
                              "p-2 rounded-lg text-xs cursor-pointer transition-all duration-200 border",
                              "hover:scale-[1.02] hover:shadow-[0_4px_12px_rgb(0_0_0/0.3)]",
                              colors.bg, colors.border, colors.hoverBg
                            )}
                          >
                            <div className={cn("font-semibold truncate flex items-center gap-1", colors.text)}>
                              {isOverdue && (
                                <span className="text-red-400 shrink-0">!</span>
                              )}
                              <span className={cn("truncate", isOverdue && "text-red-400")}>{item.title}</span>
                            </div>
                            <div className={cn("truncate", isOverdue ? "text-red-400/70" : "text-gray-300")}>{item.subtitle}</div>
                          </div>
                        )
                      })
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
// CASES TAB
// ============================================

type CasesSortField = 'client' | 'phone' | 'case_code' | 'services' | 'due_date' | 'last_interacted'
type SortDirection = 'asc' | 'desc'

function MyCasesTab({ cases }: { cases: any[] }) {
  const router = useRouter()
  const [sortField, setSortField] = useState<CasesSortField>('due_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: CasesSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedCases = [...cases].sort((a, b) => {
    let aVal: any = ''
    let bVal: any = ''
    
    switch (sortField) {
      case 'client':
        aVal = [a.clients?.first_name, a.clients?.last_name].filter(Boolean).join(' ').toLowerCase()
        bVal = [b.clients?.first_name, b.clients?.last_name].filter(Boolean).join(' ').toLowerCase()
        break
      case 'phone':
        aVal = a.clients?.contact_numbers?.[0]?.number || ''
        bVal = b.clients?.contact_numbers?.[0]?.number || ''
        break
      case 'case_code':
        aVal = a.case_code || ''
        bVal = b.case_code || ''
        break
      case 'services':
        aVal = (a.case_services || []).map((s: any) => s.services?.name).filter(Boolean).join(', ').toLowerCase()
        bVal = (b.case_services || []).map((s: any) => s.services?.name).filter(Boolean).join(', ').toLowerCase()
        break
      case 'due_date':
        aVal = a.due_date ? new Date(a.due_date).getTime() : Infinity
        bVal = b.due_date ? new Date(b.due_date).getTime() : Infinity
        break
      case 'last_interacted':
        aVal = new Date(a.last_activity || a.created_at).getTime()
        bVal = new Date(b.last_activity || b.created_at).getTime()
        break
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const SortHeader = ({ field, children }: { field: CasesSortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors",
        sortField === field ? "text-blue-400" : "text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]"
      )}
    >
      {children}
      {sortField === field && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      )}
    </button>
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="h-full flex flex-col">
      {/* Header row */}
      <div className="grid grid-cols-12 gap-2 pb-2 border-b border-[hsl(var(--color-border))] mb-2">
        <div className="col-span-2"><SortHeader field="client">Client</SortHeader></div>
        <div className="col-span-2"><SortHeader field="phone">Phone</SortHeader></div>
        <div className="col-span-2"><SortHeader field="case_code">Case #</SortHeader></div>
        <div className="col-span-2"><SortHeader field="services">Services</SortHeader></div>
        <div className="col-span-2"><SortHeader field="due_date">Due Date</SortHeader></div>
        <div className="col-span-2"><SortHeader field="last_interacted">Last Activity</SortHeader></div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-1">
        {sortedCases.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">
            No cases assigned to you
          </div>
        ) : (
          sortedCases.map(c => {
            const clientName = [c.clients?.first_name, c.clients?.last_name].filter(Boolean).join(' ')
            const phone = c.clients?.contact_numbers?.[0]
            const phoneDisplay = phone ? (phone.country_code ? `${phone.country_code} ${phone.number}` : phone.number) : null
            const services = c.case_services || []
            const serviceNames = services.map((s: any) => s.services?.name).filter(Boolean).join(', ')
            const isOverdue = c.due_date && new Date(c.due_date) < today
            
            return (
              <div
                key={c.id}
                onClick={() => router.push(`/cases/${c.id}`)}
                className={cn(
                  "grid grid-cols-12 gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200",
                  "hover:bg-[hsl(var(--color-surface-hover))]",
                  isOverdue && "bg-red-500/10 hover:bg-red-500/15 border border-red-500/30"
                )}
              >
                <div className="col-span-2 text-sm text-[hsl(var(--color-text-primary))] truncate font-medium">
                  {clientName || <span className="text-[hsl(var(--color-text-secondary))] italic">No client</span>}
                </div>
                <div className="col-span-2 text-sm text-[hsl(var(--color-text-secondary))] truncate font-mono">
                  {phoneDisplay || <span className="italic">No phone</span>}
                </div>
                <div className="col-span-2 text-sm text-blue-400 truncate font-medium">
                  {c.case_code || <span className="text-[hsl(var(--color-text-secondary))] italic">No code</span>}
                </div>
                <div className="col-span-2 text-sm text-[hsl(var(--color-text-secondary))] truncate" title={serviceNames}>
                  {services.length > 0 ? (services.length === 1 ? serviceNames : `${services.length} services`) : <span className="italic">No services</span>}
                </div>
                <div className={cn("col-span-2 text-sm truncate", isOverdue ? "text-red-500 font-medium" : "text-[hsl(var(--color-text-secondary))]")}>
                  {c.due_date ? formatDueDate(c.due_date) : <span className="italic">No due date</span>}
                </div>
                <div className="col-span-2 text-sm text-[hsl(var(--color-text-secondary))] truncate">
                  {new Date(c.last_activity || c.created_at).toLocaleDateString()}
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
// TASKS TAB
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

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
                const isOverdue = t.due_date && new Date(t.due_date) < today
                
                return (
                  <div
                    key={t.id}
                    onClick={() => router.push(`/board/${t.board_id}?cardId=${t.id}`)}
                    className={cn(
                      "p-3 rounded-xl border cursor-pointer transition-all duration-200 backdrop-blur-sm overflow-hidden",
                      isOverdue 
                        ? "border-red-500/40 bg-red-500/10 hover:bg-red-500/15"
                        : "border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] hover:bg-[hsl(var(--color-surface-hover))]"
                    )}
                  >
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: statusColor }}
                          />
                          <span className={cn("font-medium truncate", isOverdue ? "text-red-400" : "text-[hsl(var(--color-text-primary))]")}>
                            {t.title}
                          </span>
                        </div>
                        <div className="text-xs text-[hsl(var(--color-text-secondary))] ml-4 truncate">
                          {t.board_statuses?.name || 'No status'}
                        </div>
                      </div>
                      <div className={cn("text-xs flex-shrink-0 ml-2", isOverdue ? "text-red-500 font-medium" : "text-[hsl(var(--color-text-secondary))]")}>
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
// PAYMENTS TAB
// ============================================

type PaymentDateFilter = 'this_month' | 'last_month' | 'custom'

function PendingPaymentsTab({ cases }: { cases: any[] }) {
  const router = useRouter()
  const [dateFilter, setDateFilter] = useState<PaymentDateFilter>('this_month')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  
  // DEBUG: Log incoming data
  console.log('[PendingPaymentsTab] cases received:', cases)
  console.log('[PendingPaymentsTab] cases count:', cases?.length)
  if (cases?.length > 0) {
    console.log('[PendingPaymentsTab] First case:', cases[0])
    console.log('[PendingPaymentsTab] First case installments:', cases[0]?.installments)
  }
  
  const now = new Date()
  
  // Calculate date ranges
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  
  // Get current filter date range
  let filterStart: Date
  let filterEnd: Date
  let filterLabel: string
  
  if (dateFilter === 'this_month') {
    filterStart = thisMonthStart
    filterEnd = thisMonthEnd
    filterLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } else if (dateFilter === 'last_month') {
    filterStart = lastMonthStart
    filterEnd = lastMonthEnd
    filterLabel = lastMonthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } else {
    filterStart = customStart ? new Date(customStart) : new Date(0)
    filterEnd = customEnd ? new Date(customEnd) : new Date()
    filterLabel = customStart && customEnd 
      ? `${new Date(customStart).toLocaleDateString()} - ${new Date(customEnd).toLocaleDateString()}`
      : 'Custom Range'
  }
  
  // DEBUG: Log date range
  console.log('[PendingPaymentsTab] Filter:', dateFilter, 'Start:', filterStart, 'End:', filterEnd)
  
  // Flatten all installments from all cases with case/client info
  const allInstallments: any[] = []
  cases.forEach(c => {
    (c.installments || []).forEach((inst: any) => {
      allInstallments.push({
        ...inst,
        case_id: c.case_id,
        case_code: c.case_code,
        client_name: c.client_name,
        service_name: inst.service_name || c.service_names || 'Payment'
      })
    })
  })
  
  // DEBUG: Log all installments
  console.log('[PendingPaymentsTab] All installments:', allInstallments)

  // Filter installments by date range
  // Use due_date if available, otherwise use created_at for paid installments without due_date
  const filteredInstallments = allInstallments.filter(inst => {
    const dateToUse = inst.due_date || inst.created_at
    if (!dateToUse) return dateFilter === 'custom' && !customStart && !customEnd
    const instDate = new Date(dateToUse)
    instDate.setHours(0, 0, 0, 0)
    return instDate >= filterStart && instDate <= filterEnd
  })
  
  // DEBUG: Log filtered installments
  console.log('[PendingPaymentsTab] Filtered installments:', filteredInstallments)

  // Calculate paid total for the filtered period
  const periodPaid = filteredInstallments
    .filter(inst => inst.paid)
    .reduce((sum, inst) => sum + (inst.amount || 0), 0)
  
  const periodTotal = filteredInstallments
    .reduce((sum, inst) => sum + (inst.amount || 0), 0)

  // Sort by due_date
  const sortedInstallments = [...filteredInstallments].sort((a, b) => {
    const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity
    const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity
    return aDate - bDate
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filterButtons = [
    { id: 'this_month' as const, label: 'This Month' },
    { id: 'last_month' as const, label: 'Last Month' },
    { id: 'custom' as const, label: 'Custom' }
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Date Filter Tabs */}
      <div className="flex gap-1 mb-3 bg-[hsl(var(--color-surface))] p-1 rounded-xl border border-[hsl(var(--color-border))] w-fit">
        {filterButtons.map(btn => (
          <button
            key={btn.id}
            onClick={() => setDateFilter(btn.id)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
              dateFilter === btn.id
                ? "bg-green-500 text-white shadow-[0_2px_8px_rgb(34_197_94/0.3)]"
                : "text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-hover))]"
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range Picker */}
      {dateFilter === 'custom' && (
        <div className="flex gap-2 mb-3 items-center">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-[hsl(var(--color-text-primary))]"
          />
          <span className="text-[hsl(var(--color-text-secondary))]">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-[hsl(var(--color-text-primary))]"
          />
        </div>
      )}

      {/* Period Summary */}
      <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
        <div className="text-xs text-green-400 mb-1">{filterLabel}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-green-400">{periodPaid.toLocaleString()} PLN</span>
          <span className="text-sm text-[hsl(var(--color-text-secondary))]">/ {periodTotal.toLocaleString()} PLN</span>
        </div>
        <div className="text-xs text-[hsl(var(--color-text-secondary))]">received / total scheduled</div>
      </div>

      {/* Installments List Header */}
      <div className="grid grid-cols-12 gap-2 pb-2 border-b border-[hsl(var(--color-border))] mb-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--color-text-secondary))]">
        <div className="col-span-2">Amount</div>
        <div className="col-span-2">Service</div>
        <div className="col-span-2">Client</div>
        <div className="col-span-2">Due Date</div>
        <div className="col-span-2">Created</div>
        <div className="col-span-2">Status</div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-1">
        {sortedInstallments.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">
            No installments in this period
          </div>
        ) : (
          sortedInstallments.map((inst, idx) => {
            const isOverdue = !inst.paid && inst.due_date && new Date(inst.due_date) < today
            
            return (
              <div
                key={`${inst.id}-${idx}`}
                onClick={() => router.push(`/cases/${inst.case_id}`)}
                className={cn(
                  "grid grid-cols-12 gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200",
                  "hover:bg-[hsl(var(--color-surface-hover))]",
                  isOverdue && "bg-red-500/10 hover:bg-red-500/15 border border-red-500/30",
                  inst.paid && "opacity-60"
                )}
              >
                <div className={cn("col-span-2 text-sm font-medium", inst.paid ? "text-green-400" : isOverdue ? "text-red-400" : "text-[hsl(var(--color-text-primary))]")}>
                  {inst.amount?.toLocaleString()} PLN
                </div>
                <div className="col-span-2 text-sm text-[hsl(var(--color-text-secondary))] truncate">
                  {inst.service_name}
                </div>
                <div className="col-span-2 text-sm text-[hsl(var(--color-text-primary))] truncate">
                  {inst.client_name}
                </div>
                <div className={cn("col-span-2 text-sm", isOverdue ? "text-red-500 font-medium" : "text-[hsl(var(--color-text-secondary))]")}>
                  {inst.due_date ? new Date(inst.due_date).toLocaleDateString() : '—'}
                </div>
                <div className="col-span-2 text-sm text-[hsl(var(--color-text-secondary))]">
                  {inst.created_at ? new Date(inst.created_at).toLocaleDateString() : '—'}
                </div>
                <div className="col-span-2">
                  {inst.paid ? (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                      Paid
                    </span>
                  ) : isOverdue ? (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      Overdue
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      Pending
                    </span>
                  )}
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
// OVERDUE TAB
// ============================================

function OverdueTab({ items }: { items: { cases: any[]; tasks: any[]; payments: any[] } }) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<'all' | 'cases' | 'tasks' | 'payments'>('all')

  const totalOverdue = items.cases.length + items.tasks.length + items.payments.length

  if (totalOverdue === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--color-text-secondary))]">
        <span className="text-4xl mb-2">✓</span>
        <span>Nothing overdue!</span>
      </div>
    )
  }

  const sections = [
    { id: 'all' as const, label: 'All', count: totalOverdue, color: 'red' },
    { id: 'cases' as const, label: 'Cases', count: items.cases.length, color: 'blue' },
    { id: 'tasks' as const, label: 'Tasks', count: items.tasks.length, color: 'purple' },
    { id: 'payments' as const, label: 'Payments', count: items.payments.length, color: 'green' }
  ]

  const sectionColors = {
    all: { active: 'bg-red-500 shadow-[0_2px_12px_rgb(239_68_68/0.4)]', badge: 'bg-red-500', badgeActive: 'bg-white/20' },
    cases: { active: 'bg-blue-500 shadow-[0_2px_12px_rgb(59_130_246/0.4)]', badge: 'bg-blue-500', badgeActive: 'bg-white/20' },
    tasks: { active: 'bg-purple-500 shadow-[0_2px_12px_rgb(168_85_247/0.4)]', badge: 'bg-purple-500', badgeActive: 'bg-white/20' },
    payments: { active: 'bg-green-500 shadow-[0_2px_12px_rgb(34_197_94/0.4)]', badge: 'bg-green-500', badgeActive: 'bg-white/20' }
  }

  // Combine all items for "All" view with type info
  const allItems = [
    ...items.cases.map(c => ({ ...c, type: 'case' as const })),
    ...items.tasks.map(t => ({ ...t, type: 'task' as const })),
    ...items.payments.map(p => ({ ...p, type: 'payment' as const }))
  ].sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0)) // Most overdue first

  const typeColors = {
    case: { bg: 'bg-blue-500/10', border: 'border-blue-500/40', text: 'text-blue-400', label: 'Case' },
    task: { bg: 'bg-purple-500/10', border: 'border-purple-500/40', text: 'text-purple-400', label: 'Task' },
    payment: { bg: 'bg-green-500/10', border: 'border-green-500/40', text: 'text-green-400', label: 'Payment' }
  }

  const handleItemClick = (item: any) => {
    if (item.type === 'case') {
      router.push(`/cases/${item.id}`)
    } else if (item.type === 'task') {
      router.push(`/board/${item.board_id}?cardId=${item.id}`)
    } else {
      router.push(`/cases/${item.case_id}`)
    }
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
        {activeSection === 'all' && (
          allItems.map((item, idx) => {
            const itemType = item.type as 'case' | 'task' | 'payment'
            const colors = typeColors[itemType]
            return (
              <div
                key={`${item.type}-${item.id}-${idx}`}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all duration-200",
                  "hover:bg-red-500/15",
                  "bg-red-500/10 border-red-500/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={cn("px-2 py-0.5 text-xs rounded-full", colors.bg, colors.text, colors.border, "border")}>
                      {colors.label}
                    </span>
                    <span className="font-medium text-red-400 truncate">
                      {item.type === 'case' ? (item.case_code || 'No code') : 
                       item.type === 'task' ? item.title : 
                       `${item.amount?.toLocaleString()} PLN`}
                    </span>
                    <span className="text-[hsl(var(--color-text-secondary))] text-sm truncate">
                      {item.type === 'case' ? item.client_name : 
                       item.type === 'task' ? item.board_name : 
                       item.client_name}
                    </span>
                  </div>
                  <span className="text-xs text-red-500 font-medium flex-shrink-0 ml-2">{item.days_overdue}d overdue</span>
                </div>
              </div>
            )
          })
        )}

        {activeSection === 'cases' && (
          items.cases.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">No overdue cases</div>
          ) : (
            items.cases.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`/cases/${c.id}`)}
                className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 backdrop-blur-sm hover:bg-red-500/15 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-red-400">{c.case_code || 'No code'}</span>
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
                className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 backdrop-blur-sm hover:bg-red-500/15 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-red-400">{t.title}</span>
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
                className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 backdrop-blur-sm hover:bg-red-500/15 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-red-400">{p.amount.toLocaleString()} PLN</span>
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
