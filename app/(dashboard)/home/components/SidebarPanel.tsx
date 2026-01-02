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
  assigned: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  comment: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  payment_received: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  claimed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  status_change: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  default: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

const actionColors: Record<string, string> = {
  assigned: 'text-blue-500 bg-blue-500/10',
  comment: 'text-purple-500 bg-purple-500/10',
  payment_received: 'text-green-500 bg-green-500/10',
  claimed: 'text-emerald-500 bg-emerald-500/10',
  overdue: 'text-red-500 bg-red-500/10',
  status_change: 'text-orange-500 bg-orange-500/10',
  default: 'text-gray-500 bg-gray-500/10'
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
    if (!activity.is_read) {
      await markActivityRead(activity.id)
      onRefreshActivities()
    }
    if (activity.entity_type === 'case') {
      router.push(`/cases/${activity.entity_id}`)
    } else if (activity.entity_type === 'card') {
      router.push('/board')
    } else if (activity.entity_type === 'installment' && activity.metadata?.case_id) {
      router.push(`/cases/${activity.metadata.case_id}`)
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
              activities.map((activity) => (
                <div
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
                    "hover:bg-[hsl(var(--color-surface-hover))] hover:scale-[1.01]",
                    !activity.is_read && "bg-[hsl(var(--color-primary))]/10 border border-[hsl(var(--color-primary))]/20"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-full flex-shrink-0",
                    actionColors[activity.action_type] || actionColors.default
                  )}>
                    {actionIcons[activity.action_type] || actionIcons.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[hsl(var(--color-text-primary))]">
                      {activity.message}
                    </p>
                    <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">
                      {formatTimeAgo(activity.created_at)}
                    </p>
                  </div>
                  {!activity.is_read && (
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--color-primary))] flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}