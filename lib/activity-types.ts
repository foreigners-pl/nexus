// Activity type definitions - shared between client and server

export type EntityType = 'cases' | 'tasks' | 'other'
export type CategoryType = 'assignments' | 'updates' | 'payments' | 'reminders' | 'messages'

export type ActivityType = 
  // Cases
  | 'case_assigned'
  | 'case_unassigned'
  | 'case_comment'
  | 'case_status_changed'
  | 'case_due_date_changed'
  | 'case_attachment_added'
  | 'case_attachment_removed'
  | 'case_payment_received'
  | 'case_payment_overdue'
  | 'case_due_today'
  | 'case_one_week_overdue'
  | 'case_one_month_overdue'
  // Tasks
  | 'task_assigned'
  | 'task_unassigned'
  | 'task_status_changed'
  | 'task_completed'
  | 'task_due_date_changed'
  | 'task_due_today'
  | 'task_one_week_overdue'
  | 'task_one_month_overdue'

export interface ActivityTypeInfo {
  id: ActivityType
  label: string
  entity: EntityType
  category: CategoryType
}

export const ACTIVITY_TYPES: ActivityTypeInfo[] = [
  // Cases - Assignments
  { id: 'case_assigned', label: 'Assigned', entity: 'cases', category: 'assignments' },
  { id: 'case_unassigned', label: 'Unassigned', entity: 'cases', category: 'assignments' },
  
  // Cases - Updates
  { id: 'case_comment', label: 'Comment Added', entity: 'cases', category: 'updates' },
  { id: 'case_status_changed', label: 'Status Changed', entity: 'cases', category: 'updates' },
  { id: 'case_due_date_changed', label: 'Due Date Changed', entity: 'cases', category: 'updates' },
  { id: 'case_attachment_added', label: 'Attachment Added', entity: 'cases', category: 'updates' },
  { id: 'case_attachment_removed', label: 'Attachment Removed', entity: 'cases', category: 'updates' },
  
  // Cases - Payments
  { id: 'case_payment_received', label: 'Payment Received', entity: 'cases', category: 'payments' },
  { id: 'case_payment_overdue', label: 'Payment Overdue', entity: 'cases', category: 'payments' },
  
  // Cases - Reminders
  { id: 'case_due_today', label: 'Due Today', entity: 'cases', category: 'reminders' },
  { id: 'case_one_week_overdue', label: '1 Week Overdue', entity: 'cases', category: 'reminders' },
  { id: 'case_one_month_overdue', label: '1 Month Overdue', entity: 'cases', category: 'reminders' },
  
  // Tasks - Assignments
  { id: 'task_assigned', label: 'Assigned', entity: 'tasks', category: 'assignments' },
  { id: 'task_unassigned', label: 'Unassigned', entity: 'tasks', category: 'assignments' },
  
  // Tasks - Updates
  { id: 'task_status_changed', label: 'Status Changed', entity: 'tasks', category: 'updates' },
  { id: 'task_completed', label: 'Completed', entity: 'tasks', category: 'updates' },
  { id: 'task_due_date_changed', label: 'Due Date Changed', entity: 'tasks', category: 'updates' },
  
  // Tasks - Reminders
  { id: 'task_due_today', label: 'Due Today', entity: 'tasks', category: 'reminders' },
  { id: 'task_one_week_overdue', label: '1 Week Overdue', entity: 'tasks', category: 'reminders' },
  { id: 'task_one_month_overdue', label: '1 Month Overdue', entity: 'tasks', category: 'reminders' },
]

export interface ActivityPreferences {
  id: string
  user_id: string
  show_in_feed: ActivityType[]
  email_notifications: ActivityType[]
  created_at: string
  updated_at: string
}

// Default: all notifications in feed
export const DEFAULT_FEED: ActivityType[] = [
  'case_assigned', 'case_unassigned',
  'case_comment', 'case_status_changed', 'case_due_date_changed',
  'case_attachment_added', 'case_attachment_removed',
  'case_payment_received', 'case_payment_overdue',
  'case_due_today', 'case_one_week_overdue', 'case_one_month_overdue',
  'task_assigned', 'task_unassigned',
  'task_status_changed', 'task_completed', 'task_due_date_changed',
  'task_due_today', 'task_one_week_overdue', 'task_one_month_overdue',
]

// Default: no email notifications
export const DEFAULT_EMAIL: ActivityType[] = []

export const ENTITY_INFO = {
  cases: { label: 'Cases', icon: 'briefcase', color: 'blue' },
  tasks: { label: 'Tasks', icon: 'check-square', color: 'purple' },
  other: { label: 'Other', icon: 'more-horizontal', color: 'gray' },
} as const

export const CATEGORY_INFO = {
  assignments: { label: 'Assignments', icon: 'user-plus', color: 'blue' },
  updates: { label: 'Updates', icon: 'refresh', color: 'purple' },
  payments: { label: 'Payments', icon: 'dollar', color: 'green' },
  reminders: { label: 'Reminders', icon: 'bell', color: 'orange' },
  messages: { label: 'Messages', icon: 'message', color: 'cyan' },
} as const

// Helper to get activities by entity and category
export function getActivitiesByEntity(entity: EntityType): Record<CategoryType, ActivityTypeInfo[]> {
  const activities = ACTIVITY_TYPES.filter(a => a.entity === entity)
  return activities.reduce((acc, activity) => {
    if (!acc[activity.category]) {
      acc[activity.category] = []
    }
    acc[activity.category].push(activity)
    return acc
  }, {} as Record<CategoryType, ActivityTypeInfo[]>)
}
