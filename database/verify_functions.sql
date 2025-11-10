-- Check if SECURITY DEFINER functions exist
SELECT 
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc 
WHERE proname IN ('user_can_view_card', 'user_can_edit_card', 'user_can_edit_board')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;
