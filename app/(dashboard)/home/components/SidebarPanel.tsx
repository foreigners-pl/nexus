'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { markActivityRead, markAllActivitiesRead, claimCase } from '@/app/actions/dashboard'
import { cn } from '@/lib/utils'
import type { ActivityLog, Case } from '@/types/database'

interface UnassignedCase extends Case {
  clients?: { first_name?: string; last_name?: string; contact_email?: string }
}

interface SidebarPanelProps {
  activities: ActivityLog[]
  cases: UnassignedCase[]
  onRefreshActivities: () => void
  onRefreshCases: () => void
}

type TabType = 'requests' | 'activity'

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const actionIcons: Record<string, React.ReactNode> = {
  // Case icon - briefcase
  case: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  // Task icon - clipboard with check
  card: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  // Chat/Conversation icon - bell for buzz
  conversation: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  // Default/fallback
  default: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// Map action types to categories
const actionToCategory: Record<string, string> = {
  // Assignments
  assigned: 'assignments',
  case_assigned: 'assignments',
  case_unassigned: 'assignments',
  task_assigned: 'assignments',
  task_unassigned: 'assignments',
  // Updates
  comment: 'updates',
  case_comment: 'updates',
  task_comment: 'updates',
  status_change: 'updates',
  case_status_changed: 'updates',
  task_status_changed: 'updates',
  task_completed: 'updates',
  case_due_date_changed: 'updates',
  task_due_date_changed: 'updates',
  case_attachment_added: 'updates',
  case_attachment_removed: 'updates',
  // Payments
  payment_received: 'payments',
  case_payment_received: 'payments',
  case_payment_overdue: 'payments',
  claimed: 'payments',
  // Reminders
  overdue: 'reminders',
  case_due_today: 'reminders',
  case_one_week_overdue: 'reminders',
  case_one_month_overdue: 'reminders',
  task_due_today: 'reminders',
  task_one_week_overdue: 'reminders',
  task_one_month_overdue: 'reminders',
  // Chat
  buzz: 'chat',
}

// Category colors for icons and unread backgrounds
const categoryColors = {
  assignments: {
    icon: 'text-blue-400 bg-blue-400/20',
    unread: 'bg-blue-500/15 border border-blue-500/30'
  },
  updates: {
    icon: 'text-purple-400 bg-purple-400/20',
    unread: 'bg-purple-500/15 border border-purple-500/30'
  },
  payments: {
    icon: 'text-green-400 bg-green-400/20',
    unread: 'bg-green-500/15 border border-green-500/30'
  },
  reminders: {
    icon: 'text-orange-400 bg-orange-400/20',
    unread: 'bg-orange-500/15 border border-orange-500/30'
  },
  chat: {
    icon: 'text-yellow-400 bg-yellow-400/20',
    unread: 'bg-yellow-500/15 border border-yellow-500/30'
  },
  default: {
    icon: 'text-gray-400 bg-gray-400/20',
    unread: 'bg-gray-500/15 border border-gray-500/30'
  }
} as const

function getCategoryColors(actionType: string) {
  const category = actionToCategory[actionType] || 'default'
  return categoryColors[category as keyof typeof categoryColors] || categoryColors.default
}

export function SidebarPanel({ activities, cases, onRefreshActivities, onRefreshCases }: SidebarPanelProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('activity')
  const [loading, setLoading] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const unreadCount = activities.filter(a => !a.is_read).length

  const handleMarkAllRead = async () => {
    setLoading(true)
    await markAllActivitiesRead()
    onRefreshActivities()
    setLoading(false)
  }

  const handleActivityClick = async (activity: ActivityLog) => {
    // Navigate first
    if (activity.entity_type === 'case') {
      router.push(`/cases/${activity.entity_id}`)
    } else if (activity.entity_type === 'card') {
      router.push('/board')
    } else if (activity.entity_type === 'installment' && activity.metadata?.case_id) {
      router.push(`/cases/${activity.metadata.case_id}`)
    } else if (activity.entity_type === 'conversation') {
      router.push(`/chat?conversation=${activity.entity_id}`)
    }
    
    // Mark as read in background (don't await or refresh - we're navigating away)
    if (!activity.is_read) {
      markActivityRead(activity.id)
    }
  }

  const handleClaim = async (caseId: string) => {
    setClaimingId(caseId)
    const result = await claimCase(caseId)
    if (result.error) {
      alert(result.error)
    } else {
      onRefreshCases()
    }
    setClaimingId(null)
  }

  const handleViewCase = (caseId: string) => {
    router.push(`/cases/${caseId}`)
  }

  const tabs = [
    { 
      id: 'activity' as TabType, 
      label: 'Recent Activity', 
      count: unreadCount > 0 ? unreadCount : null,
      colorClass: 'text-blue-400',
      bgClass: 'bg-blue-400/20',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )
    },
    { 
      id: 'requests' as TabType, 
      label: 'New Requests', 
      count: cases.length,
      colorClass: 'text-orange-400',
      bgClass: 'bg-orange-400/20',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      )
    }
  ]

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-2 pt-3 px-3">
        {/* Tabs - Glass Style */}
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 cursor-pointer",
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
                "p-1.5 rounded-lg transition-all duration-300",
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
                    "text-sm font-bold transition-all duration-300",
                    tab.colorClass,
                    activeTab === tab.id && "drop-shadow-[0_0_8px_currentColor]"
                  )}>{tab.count}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pt-0 px-3 pb-3">
        {/* New Requests Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-3">
            {cases.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-[hsl(var(--color-text-secondary))] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-[hsl(var(--color-text-secondary))] mt-2">
                  No unassigned cases
                </p>
                <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                  All cases have been claimed
                </p>
              </div>
            ) : (
              cases.map((caseItem) => {
                const clientName = caseItem.clients 
                  ? [caseItem.clients.first_name, caseItem.clients.last_name].filter(Boolean).join(' ')
                  : null
                
                return (
                  <div
                    key={caseItem.id}
                    className="p-3 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] backdrop-blur-sm hover:bg-[hsl(var(--color-surface-hover))] transition-all duration-200 cursor-pointer hover:scale-[1.01] hover:shadow-[0_4px_16px_rgb(0_0_0/0.2)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div 
                          className="font-medium text-[hsl(var(--color-text-primary))] cursor-pointer hover:text-[hsl(var(--color-primary))]"
                          onClick={() => handleViewCase(caseItem.id)}
                        >
                          {caseItem.case_code || 'New Case'}
                        </div>
                        {clientName && (
                          <div className="text-sm text-[hsl(var(--color-text-secondary))] truncate">
                            {clientName}
                          </div>
                        )}
                        {caseItem.clients?.contact_email && (
                          <div className="text-xs text-[hsl(var(--color-text-secondary))] truncate">
                            {caseItem.clients.contact_email}
                          </div>
                        )}
                        <div className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">
                          Created {formatTimeAgo(caseItem.created_at)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleClaim(caseItem.id)}
                        disabled={claimingId === caseItem.id}
                        className="flex-shrink-0"
                      >
                        {claimingId === caseItem.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          'Claim'
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Recent Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-2">
            {unreadCount > 0 && (
              <div className="flex justify-end mb-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleMarkAllRead}
                  disabled={loading}
                >
                  Mark all read
                </Button>
              </div>
            )}
            {activities.length === 0 ? (
              <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-8">
                No recent activity
              </p>
            ) : (
              activities.map((activity) => {
                const colors = getCategoryColors(activity.action_type)
                const entityLabel = activity.entity_type === 'case' ? 'Case' : activity.entity_type === 'card' ? 'Task' : null
                return (
                <div
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
                    "hover:scale-[1.01]",
                    colors.unread
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-full flex-shrink-0",
                    colors.icon
                  )}>
                    {actionIcons[activity.entity_type] || actionIcons.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    {entityLabel && (
                      <span className="text-[10px] font-medium text-[hsl(var(--color-text-secondary))] uppercase tracking-wide">
                        {entityLabel}
                      </span>
                    )}
                    <p className="text-sm text-[hsl(var(--color-text-primary))]">
                      {activity.message}
                    </p>
                    <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">
                      {formatTimeAgo(activity.created_at)}
                    </p>
                  </div>
                  {!activity.is_read && (
                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                  )}
                </div>
              )})
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}