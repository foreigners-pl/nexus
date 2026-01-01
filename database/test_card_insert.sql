-- ============================================
-- TEST CARD INSERT - Run in Supabase SQL Editor
-- ============================================

-- Step 1: Get your boards and their owner_id
SELECT id, name, owner_id, is_system FROM boards;

-- Step 2: Get board_statuses for a specific board
-- Replace BOARD_ID with an actual board ID from step 1
-- SELECT id, name FROM board_statuses WHERE board_id = 'BOARD_ID';

-- Step 3: Check the function definition
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'user_can_edit_board';

-- Step 4: Test the function with a specific user and board
-- Replace BOARD_ID and USER_ID with actual values from steps 1 and your user ID
-- SELECT public.user_can_edit_board('BOARD_ID'::uuid, 'USER_ID'::uuid);

-- Step 5: Test direct insert (bypasses RLS in SQL Editor)
-- This will work because SQL Editor runs as superuser
-- INSERT INTO cards (board_id, status_id, title, position, created_by)
-- VALUES ('BOARD_ID', 'STATUS_ID', 'Test Card', 0, 'USER_ID')
-- RETURNING *;

-- ============================================
-- THE FIX: The issue is likely that auth.uid() is working correctly
-- but the board's owner_id doesn't match, OR there's no board_access entry.
--
-- Quick fix: Verify your user owns the board:
-- ============================================

-- Run this to see ALL boards with ownership info:
SELECT 
  b.id as board_id,
  b.name as board_name,
  b.owner_id,
  u.email as owner_email,
  b.is_system
FROM boards b
LEFT JOIN auth.users u ON b.owner_id = u.id;
