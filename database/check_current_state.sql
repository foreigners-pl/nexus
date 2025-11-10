-- Run this in Supabase SQL Editor to check current state

-- Check what functions exist
SELECT 
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc 
WHERE proname LIKE '%card%' 
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- Check what policies exist on cards table
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'cards'
ORDER BY policyname;

-- Check what policies exist on card_assignees table  
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'card_assignees'
ORDER BY policyname;
