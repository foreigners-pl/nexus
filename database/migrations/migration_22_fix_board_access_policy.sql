-- Migration: Fix Board Access RLS Policy - Allow Board Owners to View All Access
-- Date: 2025-11-09
-- Description: Fixes the RLS policy so board owners can view all access records for their boards
--              This allows the ShareBoardModal to work properly

-- Drop the current restrictive policy
DROP POLICY IF EXISTS "Users can view board access" ON board_access;

-- Create new policy that allows:
-- 1. Users to view their own access records
-- 2. Board owners to view ALL access records for their boards
CREATE POLICY "Users can view board access"
ON board_access FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = board_access.board_id
    AND boards.owner_id = auth.uid()
  )
);

COMMENT ON POLICY "Users can view board access" ON board_access IS 
'Allows users to view their own access records and board owners to view all access for their boards';
