-- Fix: Recreate the INSERT policy for card_assignees with proper WITH CHECK clause

DROP POLICY IF EXISTS "Owners and editors can assign cards" ON card_assignees;

CREATE POLICY "Owners and editors can assign cards"
ON card_assignees FOR INSERT
TO authenticated
WITH CHECK (public.user_can_edit_card(card_id, auth.uid()));
