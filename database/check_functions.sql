-- Check if the SECURITY DEFINER functions exist and are configured correctly
SELECT 
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname IN ('user_can_view_card', 'user_can_edit_card', 'user_can_edit_board')
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY p.proname;
