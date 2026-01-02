-- Migration 42: Drop Activity Log Triggers
-- We're handling activity logging in Next.js server actions instead of database triggers
-- This avoids duplicates and gives us more control over the messages

-- Drop triggers
DROP TRIGGER IF EXISTS on_case_assignment ON case_assignees;
DROP TRIGGER IF EXISTS on_card_assignment ON card_assignees;
DROP TRIGGER IF EXISTS on_case_comment ON comments;
DROP TRIGGER IF EXISTS on_comment_added ON comments;
DROP TRIGGER IF EXISTS on_installment_payment ON installments;

-- Drop trigger functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS trigger_case_assignment_activity() CASCADE;
DROP FUNCTION IF EXISTS trigger_card_assignment_activity() CASCADE;
DROP FUNCTION IF EXISTS trigger_comment_activity() CASCADE;
DROP FUNCTION IF EXISTS trigger_payment_activity() CASCADE;

-- Note: We're keeping the log_activity() function in case we want to use it from server actions via RPC
-- If you want to remove it too, uncomment:
-- DROP FUNCTION IF EXISTS log_activity(UUID, UUID, TEXT, TEXT, UUID, TEXT, JSONB);
