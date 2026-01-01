-- Migration 35: Create function to get all board users (bypasses RLS)
-- This allows users to see ALL collaborators on a board for assignee selection

CREATE OR REPLACE FUNCTION public.get_board_user_ids(board_uuid UUID)
RETURNS UUID[] AS $$
DECLARE
  user_ids UUID[];
  owner_uuid UUID;
BEGIN
  -- Get board owner
  SELECT owner_id INTO owner_uuid
  FROM boards
  WHERE id = board_uuid;
  
  IF owner_uuid IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  
  -- Start with owner
  user_ids := ARRAY[owner_uuid];
  
  -- Add all users from board_access (bypasses RLS because SECURITY DEFINER)
  SELECT array_agg(DISTINCT user_id)
  INTO user_ids
  FROM (
    SELECT owner_uuid AS user_id
    UNION
    SELECT user_id FROM board_access WHERE board_id = board_uuid
  ) combined;
  
  RETURN COALESCE(user_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_board_user_ids(UUID) IS 
'Returns all user IDs who have access to a board (owner + board_access users). Uses SECURITY DEFINER to bypass RLS.';
