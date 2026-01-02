'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { markActivityRead, markAllActivitiesRead } from '@/app/actions/dashboard'
import { cn } from '@/lib/utils'
import type { ActivityLog } from '@/types/database'

interface ActivityFeedProps {
  activities: ActivityLog[]
  onRefresh: () => void
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

export function ActivityFeed({ activities, onRefresh }: ActivityFeedProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleMarkAllRead = async () => {
    setLoading(true)
    await markAllActivitiesRead()
    onRefresh()
    setLoading(false)
  }

  const handleActivityClick = async (activity: ActivityLog) => {
    // Mark as read
    if (!activity.is_read) {
      await markActivityRead(activity.id)
      onRefresh()
    }

    // Navigate to the relevant page
    if (activity.entity_type === 'case') {
      router.push(`/cases/${activity.entity_id}`)
    } else if (activity.entity_type === 'card') {
      // For cards, we need the board ID - it's in metadata or we go to board list
      router.push('/board')
    } else if (activity.entity_type === 'installment') {
      // Installments link to case payment panel - need case ID from metadata
      if (activity.metadata?.case_id) {
        router.push(`/cases/${activity.metadata.case_id}`)
      }
    }
  }

  const unreadCount = activities.filter(a => !a.is_read).length

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Recent Activity
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleMarkAllRead}
              disabled={loading}
            >
              Mark all read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-2 pt-0">
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
                "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                "hover:bg-[hsl(var(--color-surface-hover))]",
                !activity.is_read && "bg-[hsl(var(--color-primary))]/5"
              )}
            >
              <div className={cn(
                "p-2 rounded-full flex-shrink-0",
                actionColors[activity.action_type] || actionColors.default
              )}>
                {actionIcons[activity.action_type] || actionIcons.default}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm",
                  !activity.is_read ? "font-medium text-[hsl(var(--color-text-primary))]" : "text-[hsl(var(--color-text-secondary))]"
                )}>
                  {activity.message}
                </p>
                <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5">
                  {formatTimeAgo(activity.created_at)}
                </p>
              </div>
              {!activity.is_read && (
                <div className="w-2 h-2 rounded-full bg-[hsl(var(--color-primary))] flex-shrink-0 mt-2" />
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}