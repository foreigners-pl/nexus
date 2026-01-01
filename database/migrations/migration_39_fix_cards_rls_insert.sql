-- Migration 39: Fix cards RLS INSERT policy
-- ===========================================
-- Problem: When creating a card, getting error:
--   "new row violates row-level security policy for table cards"
--
-- Root cause: The user_can_edit_board function used in the INSERT policy
-- may have been dropped/recreated incorrectly or RLS on dependent tables
-- is blocking the SECURITY DEFINER function's queries.
--
-- Solution: Recreate all card-related functions with proper SECURITY DEFINER
-- and ensure the INSERT policy is correctly defined.

-- ============================================
-- STEP 1: Diagnostic queries (run these to check current state)
-- ============================================

-- Check if RLS is enabled on cards
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'cards';

-- Check existing policies on cards
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'cards';

-- Check if user_can_edit_board function exists
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'user_can_edit_board';

-- ============================================
-- STEP 2: Drop and recreate the functions
-- ============================================

-- Drop existing functions (CASCADE to also drop dependent policies)
DROP FUNCTION IF EXISTS public.user_can_edit_board(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_view_card(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_edit_card(UUID, UUID) CASCADE;

-- ============================================
-- STEP 3: Recreate user_can_edit_board function
-- This is used for INSERT on cards (checks if user can create cards in a board)
-- ============================================

CREATE OR REPLACE FUNCTION public.user_can_edit_board(board_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_owner BOOLEAN := FALSE;
  has_editor_access BOOLEAN := FALSE;
BEGIN
  -- Check if user is board owner (direct check on boards table)
  SELECT EXISTS(
    SELECT 1 FROM boards
    WHERE id = board_uuid AND owner_id = user_uuid
  ) INTO is_owner;
  
  IF is_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has editor or owner access via board_access
  -- SECURITY DEFINER ensures this query bypasses RLS on board_access
  SELECT EXISTS(
    SELECT 1 FROM board_access
    WHERE board_id = board_uuid 
    AND user_id = user_uuid
    AND access_level IN ('owner', 'editor')
  ) INTO has_editor_access;
  
  RETURN has_editor_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.user_can_edit_board IS 
'Checks if a user can edit a board (create/update cards). Returns true if user is owner or has editor access. Uses SECURITY DEFINER to bypass RLS.';

-- ============================================
-- STEP 4: Recreate user_can_view_card function
-- This is used for SELECT on cards
-- ============================================

CREATE OR REPLACE FUNCTION public.user_can_view_card(card_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  board_uuid UUID;
  is_owner BOOLEAN := FALSE;
  has_access BOOLEAN := FALSE;
BEGIN
  -- Get the board_id for this card
  SELECT board_id INTO board_uuid
  FROM cards
  WHERE id = card_uuid;
  
  IF board_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is board owner
  SELECT EXISTS(
    SELECT 1 FROM boards
    WHERE id = board_uuid AND owner_id = user_uuid
  ) INTO is_owner;
  
  IF is_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has any access via board_access (viewer, editor, or owner)
  SELECT EXISTS(
    SELECT 1 FROM board_access
    WHERE board_id = board_uuid 
    AND user_id = user_uuid
  ) INTO has_access;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.user_can_view_card IS 
'Checks if a user can view a card. Returns true if user owns the board or has any access level. Uses SECURITY DEFINER to bypass RLS.';

-- ============================================
-- STEP 5: Recreate user_can_edit_card function
-- This is used for UPDATE and DELETE on cards
-- ============================================

CREATE OR REPLACE FUNCTION public.user_can_edit_card(card_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  board_uuid UUID;
  is_owner BOOLEAN := FALSE;
  has_editor_access BOOLEAN := FALSE;
BEGIN
  -- Get the board_id for this card
  SELECT board_id INTO board_uuid
  FROM cards
  WHERE id = card_uuid;
  
  IF board_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is board owner
  SELECT EXISTS(
    SELECT 1 FROM boards
    WHERE id = board_uuid AND owner_id = user_uuid
  ) INTO is_owner;
  
  IF is_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has editor or owner access via board_access
  SELECT EXISTS(
    SELECT 1 FROM board_access
    WHERE board_id = board_uuid 
    AND user_id = user_uuid
    AND access_level IN ('owner', 'editor')
  ) INTO has_editor_access;
  
  RETURN has_editor_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.user_can_edit_card IS 
'Checks if a user can edit a card (update/delete). Returns true if user owns the board or has editor access. Uses SECURITY DEFINER to bypass RLS.';

-- ============================================
-- STEP 6: Ensure RLS is enabled on cards
-- ============================================

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 7: Drop all existing cards policies
-- ============================================

DROP POLICY IF EXISTS "Users can view accessible cards" ON cards;
DROP POLICY IF EXISTS "Owners and editors can create cards" ON cards;
DROP POLICY IF EXISTS "Owners and editors can update cards" ON cards;
DROP POLICY IF EXISTS "Owners and editors can delete cards" ON cards;

-- ============================================
-- STEP 8: Recreate cards RLS policies
-- ============================================

-- SELECT: Anyone with board access can view cards
CREATE POLICY "Users can view accessible cards"
ON cards FOR SELECT
TO authenticated
USING (public.user_can_view_card(id, auth.uid()));

-- INSERT: Board owners and editors can create cards
-- Note: Uses board_id from the NEW row, not card id (card doesn't exist yet)
CREATE POLICY "Owners and editors can create cards"
ON cards FOR INSERT
TO authenticated
WITH CHECK (public.user_can_edit_board(board_id, auth.uid()));

-- UPDATE: Board owners and editors can update cards
CREATE POLICY "Owners and editors can update cards"
ON cards FOR UPDATE
TO authenticated
USING (public.user_can_edit_card(id, auth.uid()))
WITH CHECK (public.user_can_edit_card(id, auth.uid()));

-- DELETE: Board owners and editors can delete cards
CREATE POLICY "Owners and editors can delete cards"
ON cards FOR DELETE
TO authenticated
USING (public.user_can_edit_card(id, auth.uid()));

-- ============================================
-- STEP 9: Add policy comments
-- ============================================

COMMENT ON POLICY "Users can view accessible cards" ON cards IS 
'Users can view cards if they own the board or have any access via board_access.';

COMMENT ON POLICY "Owners and editors can create cards" ON cards IS 
'Only board owners and users with editor access can create cards.';

COMMENT ON POLICY "Owners and editors can update cards" ON cards IS 
'Only board owners and users with editor access can update cards.';

COMMENT ON POLICY "Owners and editors can delete cards" ON cards IS 
'Only board owners and users with editor access can delete cards.';

-- ============================================
-- STEP 10: Verification queries
-- ============================================

-- Run these after applying the migration to verify:

-- 1. Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'cards';
-- Expected: rowsecurity = true

-- 2. Check policies exist
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'cards' ORDER BY policyname;
-- Expected: 4 policies (INSERT, SELECT, UPDATE, DELETE)

-- 3. Check functions exist with SECURITY DEFINER
-- SELECT proname, prosecdef FROM pg_proc 
-- WHERE proname IN ('user_can_edit_board', 'user_can_view_card', 'user_can_edit_card')
-- AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Expected: 3 functions, all with prosecdef = true

-- 4. Test creating a card (as authenticated user who owns a board):
-- INSERT INTO cards (board_id, status_id, title, position, created_by)
-- VALUES ('your-board-id', 'your-status-id', 'Test Card', 0, auth.uid());
