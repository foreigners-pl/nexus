-- ============================================
-- CARDS RLS DIAGNOSTIC QUERIES
-- Run these in Supabase SQL Editor to diagnose the issue
-- ============================================

-- 1. Check if RLS is enabled on cards table
SELECT 
  schemaname,
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'cards';
-- Expected: rls_enabled = true

-- 2. Check all policies on cards table
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'cards'
ORDER BY policyname;
-- Expected: 4 policies for SELECT, INSERT, UPDATE, DELETE

-- 3. Check if required functions exist
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  provolatile as volatility
FROM pg_proc 
WHERE proname IN ('user_can_edit_board', 'user_can_view_card', 'user_can_edit_card')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;
-- Expected: 3 functions, all with is_security_definer = true

-- 4. Check function definitions
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname IN ('user_can_edit_board', 'user_can_view_card', 'user_can_edit_card')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 5. Check RLS status on related tables
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('cards', 'boards', 'board_access', 'board_statuses')
ORDER BY tablename;

-- 6. Check policies on board_access (might be blocking)
SELECT 
  policyname,
  cmd,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'board_access'
ORDER BY policyname;

-- 7. Get your current user ID
SELECT id, email FROM auth.users LIMIT 5;

-- 8. Check boards you own (should be able to create cards here)
SELECT id, name, owner_id 
FROM boards 
WHERE owner_id = auth.uid();

-- 9. Check boards you have access to
SELECT b.id, b.name, ba.access_level
FROM boards b
JOIN board_access ba ON b.id = ba.board_id
WHERE ba.user_id = auth.uid();

-- 10. Test the user_can_edit_board function directly
-- Replace 'your-board-id' with an actual board ID you own
-- SELECT public.user_can_edit_board('your-board-id'::uuid, auth.uid());

-- ============================================
-- IF THE ABOVE TESTS FAIL:
-- ============================================

-- Option A: The function doesn't exist
-- Run: database/migrations/migration_39_fix_cards_rls_insert.sql

-- Option B: RLS is disabled
-- Run: ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Option C: Policies are missing
-- Run: database/migrations/migration_39_fix_cards_rls_insert.sql

-- Option D: TEMPORARY FIX - Disable RLS (NOT recommended for production)
-- ALTER TABLE cards DISABLE ROW LEVEL SECURITY;
