-- Migration 26: Fix cards INSERT policy to properly check board access
-- Issue: The user_can_edit_board function wasn't finding owner access properly
-- Solution: Simplify the check and ensure it works for both owners and editors

-- Drop existing function and policy
DROP POLICY IF EXISTS "Owners and editors can create cards" ON cards;
DROP FUNCTION IF EXISTS public.user_can_edit_board(UUID, UUID) CASCADE;

-- Recreate the function with better logic
CREATE OR REPLACE FUNCTION public.user_can_edit_board(board_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is board owner
  IF EXISTS(
    SELECT 1 FROM boards
    WHERE id = board_uuid AND owner_id = user_uuid
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has editor or owner access via board_access
  IF EXISTS(
    SELECT 1 FROM board_access
    WHERE board_id = board_uuid 
    AND user_id = user_uuid
    AND access_level IN ('owner', 'editor')
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate the INSERT policy
CREATE POLICY "Owners and editors can create cards"
ON cards FOR INSERT
TO authenticated
WITH CHECK (public.user_can_edit_board(board_id, auth.uid()));
