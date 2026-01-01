-- Migration 37: Proper RLS policies without recursion
-- Simple policies that work correctly for boards, board_access, cards, and card_assignees

-- ============================================
-- BOARDS: Enable RLS with simple policy
-- ============================================

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Drop all existing board policies
DROP POLICY IF EXISTS "Users can view accessible boards" ON boards;
DROP POLICY IF EXISTS "Users can view boards" ON boards;

-- Simple policy: users see system boards, their own boards, and boards in board_access
-- Uses existing user_has_board_access function from migration 23
CREATE POLICY "Users can view accessible boards"
ON boards FOR SELECT
TO authenticated
USING (
  is_system = true OR
  owner_id = auth.uid() OR
  public.user_has_board_access(id, auth.uid())
);

-- ============================================
-- BOARD_ACCESS: Enable RLS with complete policies
-- ============================================

ALTER TABLE board_access ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view board access" ON board_access;
DROP POLICY IF EXISTS "Users can view board access for accessible boards" ON board_access;
DROP POLICY IF EXISTS "Users can view their own board access" ON board_access;
DROP POLICY IF EXISTS "Owners and editors can manage board access" ON board_access;
DROP POLICY IF EXISTS "Owners can manage board access" ON board_access;
DROP POLICY IF EXISTS "Owners and editors can share boards" ON board_access;
DROP POLICY IF EXISTS "Owners can remove board access" ON board_access;
DROP POLICY IF EXISTS "Owners and editors can update access" ON board_access;

-- Create helper function to check if user can manage board access
CREATE OR REPLACE FUNCTION public.user_can_manage_board(board_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is board owner (bypasses RLS)
  IF EXISTS(
    SELECT 1 FROM boards
    WHERE id = board_uuid AND owner_id = user_uuid
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has editor or owner access (bypasses RLS)
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

-- SELECT: users can only see their own access records
-- (This prevents recursion - getBoardUsers function bypasses this)
CREATE POLICY "Users can view board access"
ON board_access FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Board owners and editors can share boards
CREATE POLICY "Owners and editors can share boards"
ON board_access FOR INSERT
TO authenticated
WITH CHECK (public.user_can_manage_board(board_id, auth.uid()));

-- DELETE: Board owners can remove access
CREATE POLICY "Owners can remove board access"
ON board_access FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = board_id
    AND boards.owner_id = auth.uid()
  )
);

-- UPDATE: Board owners and editors can update access levels  
CREATE POLICY "Owners and editors can update access"
ON board_access FOR UPDATE
TO authenticated
USING (public.user_can_manage_board(board_id, auth.uid()));

-- ============================================
-- CARDS: Enable RLS with existing policies
-- ============================================

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Drop existing card policies first
DROP POLICY IF EXISTS "Users can view accessible cards" ON cards;
DROP POLICY IF EXISTS "Owners and editors can create cards" ON cards;
DROP POLICY IF EXISTS "Owners and editors can update cards" ON cards;
DROP POLICY IF EXISTS "Owners and editors can delete cards" ON cards;

-- SELECT: Anyone with board access can view cards
CREATE POLICY "Users can view accessible cards"
ON cards FOR SELECT
TO authenticated
USING (public.user_can_view_card(id, auth.uid()));

-- INSERT: Board owners and editors can create cards
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
-- CARD_ASSIGNEES: Enable RLS with existing policies
-- ============================================

ALTER TABLE card_assignees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view card assignees for accessible cards" ON card_assignees;
DROP POLICY IF EXISTS "Owners and editors can assign cards" ON card_assignees;
DROP POLICY IF EXISTS "Owners and editors can remove assignees" ON card_assignees;
DROP POLICY IF EXISTS "No one can update assignees" ON card_assignees;

-- SELECT: Anyone who can view the card can see its assignees
CREATE POLICY "Users can view card assignees for accessible cards"
ON card_assignees FOR SELECT
TO authenticated
USING (public.user_can_view_card(card_id, auth.uid()));

-- INSERT: Board owners and editors can assign users to cards
CREATE POLICY "Owners and editors can assign cards"
ON card_assignees FOR INSERT
TO authenticated
WITH CHECK (public.user_can_assign_card(card_id, auth.uid()));

-- DELETE: Board owners and editors can remove assignees
CREATE POLICY "Owners and editors can remove assignees"
ON card_assignees FOR DELETE
TO authenticated
USING (public.user_can_assign_card(card_id, auth.uid()));

-- UPDATE: No one can update assignees (they should only be created or deleted)
CREATE POLICY "No one can update assignees"
ON card_assignees FOR UPDATE
TO authenticated
USING (false);
