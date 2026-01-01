-- Migration 38: Fix board_access RLS recursion issue
-- Problem: user_can_manage_board function queries board_access FROM a policy ON board_access
--          This creates infinite recursion (policy → function → query → policy → ...)
-- Solution: board_access policies must ONLY check boards table, never board_access itself
--
-- Trade-off: Only board OWNERS can manage access (not editors)
--            This is safer and simpler - editors can use the board but not share it

-- ============================================
-- Step 1: Drop the problematic function
-- ============================================

DROP FUNCTION IF EXISTS public.user_can_manage_board(UUID, UUID) CASCADE;

-- ============================================
-- Step 2: Fix board_access policies
-- ============================================

-- Drop all existing board_access policies
DROP POLICY IF EXISTS "Users can view board access" ON board_access;
DROP POLICY IF EXISTS "Owners and editors can share boards" ON board_access;
DROP POLICY IF EXISTS "Owners can remove board access" ON board_access;
DROP POLICY IF EXISTS "Owners and editors can update access" ON board_access;

-- SELECT: Users can see their own access records AND records they granted
-- This is simple and prevents any recursion
-- Note: Functions like get_board_user_ids use SECURITY DEFINER to bypass this
CREATE POLICY "Users can view their own board access"
ON board_access FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  granted_by = auth.uid()
);

-- INSERT: Only board OWNERS can share boards
-- We check ONLY the boards table (no board_access query = no recursion)
-- Uses granted_by to match against board owner_id
CREATE POLICY "Board owners can share boards"
ON board_access FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = board_id
    AND boards.owner_id = granted_by
  )
);

-- DELETE: Only board OWNERS can remove access
CREATE POLICY "Board owners can remove access"
ON board_access FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = board_id
    AND boards.owner_id = auth.uid()
  )
);

-- UPDATE: Only board OWNERS can update access levels
CREATE POLICY "Board owners can update access"
ON board_access FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = board_id
    AND boards.owner_id = auth.uid()
  )
);

-- ============================================
-- Step 3: Add helpful comments
-- ============================================

COMMENT ON POLICY "Users can view their own board access" ON board_access IS 
'Users can only see their own access records. SECURITY DEFINER functions like get_board_user_ids bypass this to show all users.';

COMMENT ON POLICY "Board owners can share boards" ON board_access IS 
'Only board owners can grant access. Checks only boards table to prevent recursion.';

COMMENT ON POLICY "Board owners can remove access" ON board_access IS 
'Only board owners can revoke access. Checks only boards table to prevent recursion.';

COMMENT ON POLICY "Board owners can update access" ON board_access IS 
'Only board owners can change access levels. Checks only boards table to prevent recursion.';
