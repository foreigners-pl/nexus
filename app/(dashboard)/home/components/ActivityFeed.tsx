'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { markActivityRead, markActivityReadSilent, markAllActivitiesRead } from '@/app/actions/dashboard'
import { cn } from '@/lib/utils'
import type { ActivityLog } from '@/types/database'

interface ActivityFeedProps {
  activities: ActivityLog[]
  onRefresh: () => void
}

const actionIcons: Record<string, React.ReactNode> = {
  // Case actions
  case_created: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  case_assigned: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  case_unassigned: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
    </svg>
  ),
  case_comment: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  case_status_changed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  case_payment_received: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  case_payment_due: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  case_payment_overdue: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  case_attachment_added: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
  case_attachment_removed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
  case_service_added: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  case_service_removed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  ),
  case_installment_added: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  case_due_date_changed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  // Task actions
  task_created: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  task_assigned: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  task_unassigned: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
    </svg>
  ),
  task_comment: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  task_completed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  task_status_changed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  task_due_date_changed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  task_overdue: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  task_attachment_added: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
  // Other actions
  invoice_generated: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  invoice_sent: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  mentioned_in_comment: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
    </svg>
  ),
  // Chat/Conversation actions
  buzz: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  // Legacy compatibility
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
  default: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// Category-based colors matching settings page
const categoryColors = {
  assignments: { text: '#60a5fa', bg: 'rgba(59, 130, 246, 0.2)' },    // Blue
  updates: { text: '#c084fc', bg: 'rgba(168, 85, 247, 0.2)' },        // Purple
  payments: { text: '#4ade80', bg: 'rgba(34, 197, 94, 0.2)' },        // Green
  reminders: { text: '#fb923c', bg: 'rgba(249, 115, 22, 0.2)' },      // Orange
  chat: { text: '#facc15', bg: 'rgba(250, 204, 21, 0.2)' },           // Yellow
  default: { text: '#9ca3af', bg: 'rgba(156, 163, 175, 0.2)' }
} as const

// Map action types to their categories
const actionToCategory: Record<string, keyof typeof categoryColors> = {
  // Assignments (blue)
  case_assigned: 'assignments',
  case_unassigned: 'assignments',
  task_assigned: 'assignments',
  task_unassigned: 'assignments',
  assigned: 'assignments', // Legacy
  
  // Updates (purple)
  case_comment: 'updates',
  case_status_changed: 'updates',
  case_due_date_changed: 'updates',
  case_attachment_added: 'updates',
  case_attachment_removed: 'updates',
  task_comment: 'updates',
  task_status_changed: 'updates',
  task_completed: 'updates',
  task_due_date_changed: 'updates',
  task_attachment_added: 'updates',
  comment: 'updates', // Legacy
  
  // Payments (green)
  case_payment_received: 'payments',
  case_payment_overdue: 'payments',
  case_payment_due: 'payments',
  payment_received: 'payments', // Legacy
  
  // Reminders (orange)
  case_due_today: 'reminders',
  case_one_week_overdue: 'reminders',
  case_one_month_overdue: 'reminders',
  task_due_today: 'reminders',
  task_one_week_overdue: 'reminders',
  task_one_month_overdue: 'reminders',
  task_overdue: 'reminders',
  overdue: 'reminders', // Legacy
  
  // Chat (yellow)
  buzz: 'chat',
}

// Get color for an action type based on its category
function getActionColor(actionType: string): { text: string; bg: string } {
  const category = actionToCategory[actionType] || 'default'
  return categoryColors[category]
}

// Entity badge colors
const entityBadgeStyles = {
  case: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  card: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  conversation: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
} as const

function getEntityLabel(entityType: string): { label: string; style: string } | null {
  if (entityType === 'case') {
    return { label: 'Case', style: entityBadgeStyles.case }
  }
  if (entityType === 'card') {
    return { label: 'Task', style: entityBadgeStyles.card }
  }
  if (entityType === 'conversation') {
    return { label: 'Chat', style: entityBadgeStyles.conversation }
  }
  return null
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

  const handleActivityClick = (activity: ActivityLog) => {
    // Mark as read silently in background (no revalidation since we're leaving)
    if (!activity.is_read) {
      markActivityReadSilent(activity.id)
    }
    
    // Navigate immediately
    if (activity.entity_type === 'case') {
      router.push(`/cases/${activity.entity_id}`)
    } else if (activity.entity_type === 'card') {
      // Navigate to board with card modal open
      const boardId = activity.metadata?.board_id
      if (boardId) {
        router.push(`/board/${boardId}?cardId=${activity.entity_id}`)
      } else {
        router.push('/board')
      }
    } else if (activity.entity_type === 'installment') {
      if (activity.metadata?.case_id) {
        router.push(`/cases/${activity.metadata.case_id}`)
      }
    } else if (activity.entity_type === 'conversation') {
      router.push(`/chat?conversation=${activity.entity_id}`)
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
          activities.map((activity) => {
            const entityInfo = getEntityLabel(activity.entity_type)
            const colors = getActionColor(activity.action_type)
            return (
            <div
              key={activity.id}
              onClick={() => handleActivityClick(activity)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                "hover:bg-[hsl(var(--color-surface-hover))]",
                !activity.is_read && "bg-[hsl(var(--color-primary))]/5"
              )}
            >
              <div 
                className="p-2 rounded-full flex-shrink-0"
                style={{ color: colors.text, backgroundColor: colors.bg }}
              >
                {actionIcons[activity.action_type] || actionIcons.default}
              </div>
              <div className="flex-1 min-w-0">
                {entityInfo && (
                  <span className={cn(
                    "inline-block px-1.5 py-0.5 text-[10px] font-medium rounded mb-1",
                    entityInfo.style
                  )}>
                    {entityInfo.label}
                  </span>
                )}
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
          )})
        )}
      </CardContent>
    </Card>
  )
}