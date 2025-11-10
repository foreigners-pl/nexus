-- Migration 24: Fix card_assignees AND cards RLS policies to prevent infinite recursion
-- Issue: card_assignees and cards policies have circular dependencies via boards/board_access
-- Solution: Use SECURITY DEFINER functions to bypass RLS when checking access

-- Drop existing card_assignees policies
DROP POLICY IF EXISTS "Anyone can view card assignees" ON card_assignees;
DROP POLICY IF EXISTS "Users can view card assignees" ON card_assignees;
DROP POLICY IF EXISTS "Users can view card assignees for accessible cards" ON card_assignees;
DROP POLICY IF EXISTS "Owners and editors can assign cards" ON card_assignees;
DROP POLICY IF EXISTS "Owners and editors can remove assignees" ON card_assignees;

-- Drop existing cards policies
DROP POLICY IF EXISTS "Users can view cards" ON cards;
DROP POLICY IF EXISTS "Users can view accessible cards" ON cards;
DROP POLICY IF EXISTS "Owners and editors can create cards" ON cards;
DROP POLICY IF EXISTS "Owners and editors can update cards" ON cards;
DROP POLICY IF EXISTS "Owners and editors can delete cards" ON cards;

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.user_can_access_card(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_view_card(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_edit_card(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_edit_board(UUID, UUID) CASCADE;

-- Create helper function to check if a user can VIEW a card (for SELECT policies)
CREATE FUNCTION public.user_can_view_card(card_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  board_uuid UUID;
  can_view BOOLEAN;
BEGIN
  -- Get the board_id for this card (without RLS checks)
  SELECT board_id INTO board_uuid
  FROM cards
  WHERE id = card_uuid;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is board owner (without RLS checks)
  SELECT EXISTS(
    SELECT 1 FROM boards
    WHERE id = board_uuid AND owner_id = user_uuid
  ) INTO can_view;
  
  IF can_view THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has any access via board_access (without RLS checks)
  SELECT EXISTS(
    SELECT 1 FROM board_access
    WHERE board_id = board_uuid 
    AND user_id = user_uuid
  ) INTO can_view;
  
  RETURN can_view;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create helper function to check if a user can EDIT a card (for UPDATE/DELETE policies)
CREATE FUNCTION public.user_can_edit_card(card_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  board_uuid UUID;
  can_edit BOOLEAN;
BEGIN
  -- Get the board_id for this card (without RLS checks)
  SELECT board_id INTO board_uuid
  FROM cards
  WHERE id = card_uuid;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is board owner (without RLS checks)
  SELECT EXISTS(
    SELECT 1 FROM boards
    WHERE id = board_uuid AND owner_id = user_uuid
  ) INTO can_edit;
  
  IF can_edit THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has editor or owner access via board_access (without RLS checks)
  SELECT EXISTS(
    SELECT 1 FROM board_access
    WHERE board_id = board_uuid 
    AND user_id = user_uuid
    AND access_level IN ('owner', 'editor')
  ) INTO can_edit;
  
  RETURN can_edit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create helper function to check board access directly (for INSERT on cards - before card exists)
CREATE FUNCTION public.user_can_edit_board(board_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  can_edit BOOLEAN;
BEGIN
  -- Check if user is board owner (without RLS checks)
  SELECT EXISTS(
    SELECT 1 FROM boards
    WHERE id = board_uuid AND owner_id = user_uuid
  ) INTO can_edit;
  
  IF can_edit THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has editor or owner access via board_access (without RLS checks)
  SELECT EXISTS(
    SELECT 1 FROM board_access
    WHERE board_id = board_uuid 
    AND user_id = user_uuid
    AND access_level IN ('owner', 'editor')
  ) INTO can_edit;
  
  RETURN can_edit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- CARDS POLICIES
-- ============================================

-- SELECT: Anyone with board access can view cards
CREATE POLICY "Users can view accessible cards"
ON cards FOR SELECT
TO authenticated
USING (public.user_can_view_card(id, auth.uid()));

-- INSERT: Board owners and editors can create cards (check board_id directly since card doesn't exist yet)
CREATE POLICY "Owners and editors can create cards"
ON cards FOR INSERT
TO authenticated
WITH CHECK (public.user_can_edit_board(board_id, auth.uid()));

-- UPDATE: Board owners and editors can update cards
CREATE POLICY "Owners and editors can update cards"
ON cards FOR UPDATE
TO authenticated
USING (public.user_can_edit_card(id, auth.uid()));

-- DELETE: Board owners and editors can delete cards
CREATE POLICY "Owners and editors can delete cards"
ON cards FOR DELETE
TO authenticated
USING (public.user_can_edit_card(id, auth.uid()));

-- ============================================
-- CARD_ASSIGNEES POLICIES
-- ============================================

-- SELECT: Anyone who can view the card can see its assignees
CREATE POLICY "Users can view card assignees for accessible cards"
ON card_assignees FOR SELECT
TO authenticated
USING (public.user_can_view_card(card_id, auth.uid()));

-- INSERT: Board owners and editors can assign users to cards
CREATE POLICY "Owners and editors can assign cards"
ON card_assignees FOR INSERT
TO authenticated
WITH CHECK (public.user_can_edit_card(card_id, auth.uid()));

-- DELETE: Board owners and editors can remove assignees
CREATE POLICY "Owners and editors can remove assignees"
ON card_assignees FOR DELETE
TO authenticated
USING (public.user_can_edit_card(card_id, auth.uid()));
