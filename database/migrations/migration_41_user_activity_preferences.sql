-- Migration 41: User Activity Preferences
-- Stores user preferences for activity feed and email notifications

CREATE TABLE IF NOT EXISTS user_activity_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Array of activity types to show in feed
  show_in_feed JSONB NOT NULL DEFAULT '["case_assigned", "case_unassigned", "case_created", "case_comment", "case_status_changed", "case_due_date_changed", "case_attachment_added", "case_attachment_removed", "case_deleted", "case_payment_received", "case_installment_due", "case_due_today", "case_one_week_overdue", "case_one_month_overdue", "task_assigned", "task_unassigned", "task_comment", "task_status_changed", "task_due_date_changed", "task_deleted", "task_due_today", "task_one_week_overdue", "task_one_month_overdue"]'::jsonb,
  
  -- Array of activity types to send email notifications (none by default)
  email_notifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_activity_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own preferences
CREATE POLICY "Users can view their own preferences"
  ON user_activity_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON user_activity_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_activity_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_activity_preferences_user_id 
  ON user_activity_preferences(user_id);

-- Activity types reference (for documentation):
-- Cases:
--   case_assigned, case_unassigned, case_created
--   case_comment, case_status_changed, case_due_date_changed
--   case_attachment_added, case_attachment_removed, case_deleted
--   case_payment_received, case_installment_due
--   case_due_today, case_one_week_overdue, case_one_month_overdue
-- Tasks:
--   task_assigned, task_unassigned
--   task_comment, task_status_changed, task_due_date_changed, task_deleted
--   task_due_today, task_one_week_overdue, task_one_month_overdue
-- Other (future):
--   new_conversation, no_response_24h, no_response_48h
