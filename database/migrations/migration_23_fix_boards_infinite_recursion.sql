-- Migration: Fix Boards Table Infinite Recursion
-- Date: 2025-11-09
-- Description: Fixes infinite recursion in boards SELECT policy
--              The issue: ANY subquery in boards policy still triggers board_access RLS,
--              which checks boards, creating infinite loop
--              Solution: Create a SECURITY DEFINER function that bypasses RLS

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view accessible boards" ON boards;

-- Create a function that checks board access WITHOUT triggering RLS
-- SECURITY DEFINER means it runs with the privileges of the function owner (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_has_board_access(board_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM board_access
    WHERE board_id = board_uuid
    AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create policy using the security definer function (no RLS recursion!)
CREATE POLICY "Users can view accessible boards"
ON boards FOR SELECT
TO authenticated
USING (
  is_system = true OR
  owner_id = auth.uid() OR
  public.user_has_board_access(id, auth.uid())
);

COMMENT ON POLICY "Users can view accessible boards" ON boards IS 
'Allows users to view system boards, boards they own, or boards where they have access via board_access. Uses SECURITY DEFINER function to avoid infinite recursion.';
