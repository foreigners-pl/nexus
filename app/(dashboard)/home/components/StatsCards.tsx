'use client'

import { cn } from '@/lib/utils'

interface StatsCardsProps {
  myCasesCount: number
  myTasksCount: number
  pendingPaymentsTotal: number
  overdueCount: number
}

export function StatsCards({ myCasesCount, myTasksCount, pendingPaymentsTotal, overdueCount }: StatsCardsProps) {
  const stats = [
    {
      label: 'My Cases',
      value: myCasesCount,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: 'Open Tasks',
      value: myTasksCount,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      label: 'Pending',
      value: `${pendingPaymentsTotal.toLocaleString()} PLN`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      label: 'Overdue',
      value: overdueCount,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: overdueCount > 0 ? 'text-red-500' : 'text-gray-500',
      bgColor: overdueCount > 0 ? 'bg-red-500/10' : 'bg-gray-500/10'
    }
  ]

  return (
    <div className="flex gap-3 flex-wrap">
      {stats.map((stat) => (
        <div 
          key={stat.label} 
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]"
        >
          <div className={cn("p-1.5 rounded", stat.bgColor, stat.color)}>
            {stat.icon}
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">{stat.label}</p>
            <p className={cn("text-sm font-bold", stat.color)}>{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}