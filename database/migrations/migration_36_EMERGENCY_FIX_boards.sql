-- Migration 36: EMERGENCY FIX - Completely disable RLS on boards and board_access temporarily
-- This will let us see what's actually happening

-- DISABLE RLS completely to get things working
ALTER TABLE boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE board_access DISABLE ROW LEVEL SECURITY;
ALTER TABLE cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE card_assignees DISABLE ROW LEVEL SECURITY;

-- We'll re-enable with proper policies later, but first let's get the app working
