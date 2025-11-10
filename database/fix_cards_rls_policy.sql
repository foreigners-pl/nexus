-- ============================================
-- STEP 1: Run this FIRST to get your user ID
-- ============================================
SELECT id::text as your_user_id, email 
FROM auth.users 
LIMIT 1;

-- ============================================
-- STEP 2: Copy your user ID from above
-- Then replace BOTH instances of the placeholder below
-- Then run the INSERT statement
-- ============================================

-- THE REAL FIX: Disable RLS on cards table temporarily to test
-- This will tell us if RLS is the problem

ALTER TABLE cards DISABLE ROW LEVEL SECURITY;

-- Now try creating a card in the app
-- If it works, RLS was the problem
-- Then re-enable it and we'll fix the policies properly

-- To re-enable later:
-- ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
