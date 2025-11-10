-- Migration 25: Allow editors to update boards
-- This migration updates the RLS policies on the boards table to allow users with 'editor' access to update boards

-- Drop the old policy
DROP POLICY IF EXISTS "Owners can update their boards" ON boards;

-- Create new policy that allows both owners AND editors to update boards
CREATE POLICY "Owners and editors can update boards"
ON boards FOR UPDATE
TO authenticated
USING (
  -- Allow if user is the owner
  owner_id = auth.uid() 
  OR 
  -- Allow if user has editor or owner access level
  EXISTS (
    SELECT 1 FROM board_access
    WHERE board_access.board_id = boards.id
    AND board_access.user_id = auth.uid()
    AND board_access.access_level IN ('editor', 'owner')
  )
)
WITH CHECK (
  -- Same check for the updated data
  owner_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM board_access
    WHERE board_access.board_id = boards.id
    AND board_access.user_id = auth.uid()
    AND board_access.access_level IN ('editor', 'owner')
  )
);
