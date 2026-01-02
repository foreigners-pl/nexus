'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getWeeklyCases, getWeeklyCards, getWeeklyPayments } from '@/app/actions/dashboard'
import { cn } from '@/lib/utils'

type TabType = 'cases' | 'tasks' | 'payments'

interface TimelineItem {
  id: string
  title: string
  subtitle: string
  due_date: string
  type: TabType
  entityId: string
  color?: string
}

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
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
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

export function WeeklyTimeline() {
  const router = useRouter()
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getStartOfWeek(new Date()))
  const [activeTab, setActiveTab] = useState<TabType>('cases')
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  const weekDates = getWeekDates(currentWeekStart)
  const dateString = currentWeekStart.toISOString().split('T')[0]

  useEffect(() => {
    loadItems()
  }, [currentWeekStart, activeTab])

  async function loadItems() {
    setLoading(true)
    const startDateStr = currentWeekStart.toISOString().split('T')[0]
    
    let newItems: TimelineItem[] = []

    if (activeTab === 'cases') {
      const { cases } = await getWeeklyCases(startDateStr)
      newItems = cases.map(c => ({
        id: c.id,
        title: c.case_code || 'Unknown Case',
        subtitle: c.clients ? [c.clients.first_name, c.clients.last_name].filter(Boolean).join(' ') : 'Unknown Client',
        due_date: c.due_date || '',
        type: 'cases' as TabType,
        entityId: c.id
      }))
    } else if (activeTab === 'tasks') {
      const { cards } = await getWeeklyCards(startDateStr)
      newItems = cards.map(c => ({
        id: c.id,
        title: c.title,
        subtitle: c.boards?.name || 'Unknown Board',
        due_date: c.due_date || '',
        type: 'tasks' as TabType,
        entityId: c.id,
        color: c.board_statuses?.color
      }))
    } else if (activeTab === 'payments') {
      const { payments } = await getWeeklyPayments(startDateStr)
      newItems = payments.map(p => ({
        id: p.id,
        title: `${p.amount.toLocaleString()} PLN`,
        subtitle: p.cases?.clients ? [p.cases.clients.first_name, p.cases.clients.last_name].filter(Boolean).join(' ') : (p.cases?.case_code || 'Unknown'),
        due_date: p.due_date || '',
        type: 'payments' as TabType,
        entityId: p.case_id
      }))
    }

    setItems(newItems)
    setLoading(false)
  }

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    setCurrentWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    setCurrentWeekStart(newStart)
  }

  const goToThisWeek = () => {
    setCurrentWeekStart(getStartOfWeek(new Date()))
  }

  const handleItemClick = (item: TimelineItem) => {
    if (item.type === 'cases' || item.type === 'payments') {
      router.push(`/cases/${item.entityId}`)
    } else if (item.type === 'tasks') {
      router.push('/board')
    }
  }

  // Group items by date
  const itemsByDate: Record<string, TimelineItem[]> = {}
  items.forEach(item => {
    const dateKey = item.due_date.split('T')[0]
    if (!itemsByDate[dateKey]) itemsByDate[dateKey] = []
    itemsByDate[dateKey].push(item)
  })

  const tabs = [
    { id: 'cases' as TabType, label: 'Cases' },
    { id: 'tasks' as TabType, label: 'Tasks' },
    { id: 'payments' as TabType, label: 'Payments' }
  ]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3 space-y-3">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={goToPreviousWeek}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[hsl(var(--color-text-primary))]">
              {formatDateRange(currentWeekStart)}
            </span>
            <Button variant="ghost" size="sm" onClick={goToThisWeek} className="text-xs">
              Today
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={goToNextWeek}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[hsl(var(--color-surface))] rounded-lg">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === tab.id
                  ? "bg-[hsl(var(--color-background))] text-[hsl(var(--color-text-primary))] shadow-sm"
                  : "text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pt-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[hsl(var(--color-text-secondary))]">Loading...</div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2 h-full min-w-[600px]">
            {weekDates.map((date) => {
              const dateKey = date.toISOString().split('T')[0]
              const dayItems = itemsByDate[dateKey] || []
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
              const dayNum = date.getDate()
              const today = isToday(date)
              const past = isPast(date)

              return (
                <div 
                  key={dateKey} 
                  className={cn(
                    "flex flex-col rounded-lg border",
                    today 
                      ? "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]/5" 
                      : "border-[hsl(var(--color-border))]"
                  )}
                >
                  {/* Day Header */}
                  <div className={cn(
                    "px-2 py-2 text-center border-b",
                    today 
                      ? "border-[hsl(var(--color-primary))]/30" 
                      : "border-[hsl(var(--color-border))]"
                  )}>
                    <div className={cn(
                      "text-xs font-medium",
                      today ? "text-[hsl(var(--color-primary))]" : "text-[hsl(var(--color-text-secondary))]"
                    )}>
                      {dayName}
                    </div>
                    <div className={cn(
                      "text-lg font-bold",
                      today 
                        ? "text-[hsl(var(--color-primary))]" 
                        : past 
                          ? "text-[hsl(var(--color-text-secondary))]" 
                          : "text-[hsl(var(--color-text-primary))]"
                    )}>
                      {dayNum}
                    </div>
                    {today && (
                      <div className="text-[10px] font-medium text-[hsl(var(--color-primary))] uppercase">
                        Today
                      </div>
                    )}
                  </div>

                  {/* Day Items */}
                  <div className="flex-1 p-1 space-y-1 overflow-y-auto scrollbar-thin">
                    {dayItems.length === 0 ? (
                      <div className="text-xs text-[hsl(var(--color-text-secondary))] text-center py-4">
                        —
                      </div>
                    ) : (
                      dayItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            "p-2 rounded text-xs cursor-pointer transition-colors",
                            past && !today
                              ? "bg-red-500/10 hover:bg-red-500/20 border border-red-500/30"
                              : "bg-[hsl(var(--color-surface))] hover:bg-[hsl(var(--color-surface-hover))]",
                            item.color && `border-l-2`
                          )}
                          style={item.color ? { borderLeftColor: item.color } : undefined}
                        >
                          <div className={cn(
                            "font-medium truncate",
                            past && !today ? "text-red-600" : "text-[hsl(var(--color-text-primary))]"
                          )}>
                            {item.title}
                          </div>
                          <div className="text-[hsl(var(--color-text-secondary))] truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}