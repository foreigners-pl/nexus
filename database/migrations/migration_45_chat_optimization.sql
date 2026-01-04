-- Migration: Add optimized chat query functions
-- These functions improve chat loading performance by batching queries

-- Function to get last message for multiple conversations in one query
CREATE OR REPLACE FUNCTION get_last_messages(conv_ids uuid[])
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  content text,
  attachment_url text,
  attachment_name text,
  attachment_type text,
  is_system boolean,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (m.conversation_id)
    m.id,
    m.conversation_id,
    m.sender_id,
    m.content,
    m.attachment_url,
    m.attachment_name,
    m.attachment_type,
    m.is_system,
    m.created_at,
    m.updated_at
  FROM messages m
  WHERE m.conversation_id = ANY(conv_ids)
  ORDER BY m.conversation_id, m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread counts for multiple conversations in one query
CREATE OR REPLACE FUNCTION get_unread_counts(p_user_id uuid, conv_ids uuid[])
RETURNS TABLE (
  conversation_id uuid,
  unread_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.conversation_id,
    COUNT(m.id)::bigint as unread_count
  FROM conversation_members cm
  LEFT JOIN messages m ON m.conversation_id = cm.conversation_id 
    AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
    AND m.sender_id != p_user_id
  WHERE cm.user_id = p_user_id
    AND cm.conversation_id = ANY(conv_ids)
  GROUP BY cm.conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_last_messages(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_counts(uuid, uuid[]) TO authenticated;