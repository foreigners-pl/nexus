-- Migration 34: Fix viewer permissions and board_access visibility
-- Issues:
--   1. board_access RLS only shows own records, so users can't see other collaborators
--   2. Viewers can create/edit/delete cards (should be read-only)
--   3. Viewers can assign/unassign users (should be read-only)

-- Migration 34: Fix viewer permissions
-- Only handles restricting viewer actions, NOT board_access visibility
-- (board_access visibility will be handled differently to avoid recursion)

-- ============================================
-- FIX 1: Restore original board_access policy
-- ============================================

-- Drop any new policies we created
DROP POLICY IF EXISTS "Users can view board access for accessible boards" ON board_access;
DROP POLICY IF EXISTS "Users can view their own board access" ON board_access;

-- Restore the original simple policy
DROP POLICY IF EXISTS "Users can view board access" ON board_access;
CREATE POLICY "Users can view board access"
ON board_access FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- FIX 2: Restrict card UPDATE/DELETE to editors only
-- ============================================

-- Drop and recreate card UPDATE policy (was allowing all with access, now only editors)
DROP POLICY IF EXISTS "Owners and editors can update cards" ON cards;
CREATE POLICY "Owners and editors can update cards"
ON cards FOR UPDATE
TO authenticated
USING (public.user_can_edit_card(id, auth.uid()))
WITH CHECK (public.user_can_edit_card(id, auth.uid()));

-- Drop and recreate card DELETE policy (ensure only editors can delete)
DROP POLICY IF EXISTS "Owners and editors can delete cards" ON cards;
CREATE POLICY "Owners and editors can delete cards"
ON cards FOR DELETE
TO authenticated
USING (public.user_can_edit_card(id, auth.uid()));

-- ============================================
-- FIX 3: Restrict card_assignees DELETE to editors only
-- ============================================

-- Drop and recreate DELETE policy for card_assignees
DROP POLICY IF EXISTS "Owners and editors can remove assignees" ON card_assignees;
CREATE POLICY "Owners and editors can remove assignees"
ON card_assignees FOR DELETE
TO authenticated
USING (public.user_can_assign_card(card_id, auth.uid()));

-- ============================================
-- FIX 4: Restrict card_assignees UPDATE (if any)
-- ============================================

-- Prevent any updates to assignees (they should only be created or deleted)
DROP POLICY IF EXISTS "No one can update assignees" ON card_assignees;
CREATE POLICY "No one can update assignees"
ON card_assignees FOR UPDATE
TO authenticated
USING (false);
