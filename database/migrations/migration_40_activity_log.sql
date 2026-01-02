-- Migration 40: Activity Log System
-- Creates activity log for tracking user-relevant events

-- Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- Who this activity is FOR
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Who performed the action (null for system)
  action_type TEXT NOT NULL,                             -- 'assigned', 'unassigned', 'comment', 'status_change', 'payment_received', 'payment_due', 'due_reminder', 'overdue', 'claimed'
  entity_type TEXT NOT NULL,                             -- 'case', 'card', 'installment', 'invoice'
  entity_id UUID NOT NULL,                               -- ID of the case/card/etc
  message TEXT NOT NULL,                                 -- Human readable message
  metadata JSONB DEFAULT '{}',                           -- Extra data (case_code, client_name, amount, etc)
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_unread ON activity_log(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own activities
DROP POLICY IF EXISTS "Users can view their own activities" ON activity_log;
CREATE POLICY "Users can view their own activities" ON activity_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own activities" ON activity_log;
CREATE POLICY "Users can update their own activities" ON activity_log
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert activities" ON activity_log;
CREATE POLICY "System can insert activities" ON activity_log
  FOR INSERT WITH CHECK (true);

-- Function to log activity (can be called from triggers or server actions)
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_actor_id UUID,
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO activity_log (user_id, actor_id, action_type, entity_type, entity_id, message, metadata)
  VALUES (p_user_id, p_actor_id, p_action_type, p_entity_type, p_entity_id, p_message, p_metadata)
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for case assignment
CREATE OR REPLACE FUNCTION trigger_case_assignment_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_case_code TEXT;
  v_client_name TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get case and client info
  SELECT c.case_code, COALESCE(cl.first_name || ' ' || cl.last_name, cl.first_name, cl.last_name, 'Unknown')
  INTO v_case_code, v_client_name
  FROM cases c
  LEFT JOIN clients cl ON c.client_id = cl.id
  WHERE c.id = NEW.case_id;
  
  -- Get actor name if available
  SELECT COALESCE(display_name, email) INTO v_actor_name
  FROM users WHERE id = auth.uid();
  
  -- Log the assignment
  PERFORM log_activity(
    NEW.user_id,
    auth.uid(),
    'assigned',
    'case',
    NEW.case_id,
    'You were assigned to case ' || COALESCE(v_case_code, 'Unknown'),
    jsonb_build_object(
      'case_code', v_case_code,
      'client_name', v_client_name,
      'actor_name', v_actor_name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for case assignments
DROP TRIGGER IF EXISTS on_case_assignment ON case_assignees;
CREATE TRIGGER on_case_assignment
  AFTER INSERT ON case_assignees
  FOR EACH ROW
  EXECUTE FUNCTION trigger_case_assignment_activity();

-- Trigger function for card assignment
CREATE OR REPLACE FUNCTION trigger_card_assignment_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_card_title TEXT;
  v_board_name TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get card and board info
  SELECT c.title, b.name
  INTO v_card_title, v_board_name
  FROM cards c
  JOIN boards b ON c.board_id = b.id
  WHERE c.id = NEW.card_id;
  
  -- Get actor name if available
  SELECT COALESCE(display_name, email) INTO v_actor_name
  FROM users WHERE id = auth.uid();
  
  -- Log the assignment
  PERFORM log_activity(
    NEW.user_id,
    auth.uid(),
    'assigned',
    'card',
    NEW.card_id,
    'You were assigned to "' || COALESCE(v_card_title, 'Unknown') || '"',
    jsonb_build_object(
      'card_title', v_card_title,
      'board_name', v_board_name,
      'actor_name', v_actor_name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for card assignments
DROP TRIGGER IF EXISTS on_card_assignment ON card_assignees;
CREATE TRIGGER on_card_assignment
  AFTER INSERT ON card_assignees
  FOR EACH ROW
  EXECUTE FUNCTION trigger_card_assignment_activity();

-- Trigger function for comments on cases (notify all assignees)
CREATE OR REPLACE FUNCTION trigger_comment_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_case_code TEXT;
  v_commenter_name TEXT;
  v_assignee RECORD;
BEGIN
  -- Get case code
  SELECT case_code INTO v_case_code FROM cases WHERE id = NEW.case_id;
  
  -- Get commenter name
  SELECT COALESCE(display_name, email) INTO v_commenter_name
  FROM users WHERE id = NEW.user_id;
  
  -- Notify all assignees except the commenter
  FOR v_assignee IN 
    SELECT user_id FROM case_assignees WHERE case_id = NEW.case_id AND user_id != NEW.user_id
  LOOP
    PERFORM log_activity(
      v_assignee.user_id,
      NEW.user_id,
      'comment',
      'case',
      NEW.case_id,
      COALESCE(v_commenter_name, 'Someone') || ' commented on case ' || COALESCE(v_case_code, 'Unknown'),
      jsonb_build_object(
        'case_code', v_case_code,
        'commenter_name', v_commenter_name,
        'comment_preview', LEFT(NEW.text, 100)
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for comments
DROP TRIGGER IF EXISTS on_comment_added ON comments;
CREATE TRIGGER on_comment_added
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comment_activity();

-- Trigger function for payment received (installment marked as paid)
CREATE OR REPLACE FUNCTION trigger_payment_received_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_case_code TEXT;
  v_client_name TEXT;
  v_assignee RECORD;
BEGIN
  -- Only trigger when paid changes from false to true
  IF NEW.paid = true AND (OLD.paid = false OR OLD.paid IS NULL) THEN
    -- Get case and client info
    SELECT c.case_code, COALESCE(cl.first_name || ' ' || cl.last_name, cl.first_name, cl.last_name, 'Unknown')
    INTO v_case_code, v_client_name
    FROM cases c
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE c.id = NEW.case_id;
    
    -- Notify all assignees
    FOR v_assignee IN 
      SELECT user_id FROM case_assignees WHERE case_id = NEW.case_id
    LOOP
      PERFORM log_activity(
        v_assignee.user_id,
        NULL,
        'payment_received',
        'installment',
        NEW.id,
        'Payment received: ' || NEW.amount || ' PLN from ' || COALESCE(v_client_name, 'Unknown'),
        jsonb_build_object(
          'case_code', v_case_code,
          'client_name', v_client_name,
          'amount', NEW.amount
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for payments
DROP TRIGGER IF EXISTS on_payment_received ON installments;
CREATE TRIGGER on_payment_received
  AFTER UPDATE ON installments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_payment_received_activity();

COMMENT ON TABLE activity_log IS 'Stores activity notifications for users - assignments, comments, payments, etc.';