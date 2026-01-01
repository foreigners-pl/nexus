-- Migration 33: Proper card_assignees policy with board access check
-- Only board owners and users with editor access can assign users to cards

-- Drop the temporary policy
DROP POLICY IF EXISTS "Authenticated users can assign cards" ON card_assignees;

-- Create a helper function that checks if user can assign to this card
-- Using SECURITY DEFINER to bypass RLS on cards/boards/board_access tables
CREATE OR REPLACE FUNCTION public.user_can_assign_card(card_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  board_uuid UUID;
  is_owner BOOLEAN;
  has_editor_access BOOLEAN;
BEGIN
  -- Get the board_id for this card (SECURITY DEFINER bypasses cards RLS)
  SELECT board_id INTO board_uuid
  FROM cards
  WHERE id = card_uuid;
  
  IF board_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is board owner (SECURITY DEFINER bypasses boards RLS)
  SELECT (owner_id = user_uuid) INTO is_owner
  FROM boards
  WHERE id = board_uuid;
  
  IF is_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has editor or owner access (SECURITY DEFINER bypasses board_access RLS)
  SELECT EXISTS(
    SELECT 1 FROM board_access
    WHERE board_id = board_uuid
    AND user_id = user_uuid
    AND access_level IN ('owner', 'editor')
  ) INTO has_editor_access;
  
  RETURN has_editor_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create the policy using the helper function
CREATE POLICY "Owners and editors can assign cards"
ON card_assignees FOR INSERT
TO authenticated
WITH CHECK (public.user_can_assign_card(card_id, auth.uid()));
