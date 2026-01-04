-- Migration 44: Chat Meetings
-- Adds meeting tracking to conversations

-- Add meeting fields to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS active_meeting_url TEXT,
ADD COLUMN IF NOT EXISTS meeting_started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS meeting_started_at TIMESTAMPTZ;

-- Create index for finding active meetings
CREATE INDEX IF NOT EXISTS idx_conversations_active_meeting ON conversations(active_meeting_url) WHERE active_meeting_url IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN conversations.active_meeting_url IS 'URL of currently active video call for this conversation (auto-expires after 2 hours)';
COMMENT ON COLUMN conversations.meeting_started_by IS 'User who started the current meeting';
COMMENT ON COLUMN conversations.meeting_started_at IS 'When the current meeting was started';

-- Enable realtime for conversations (for meeting updates)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;