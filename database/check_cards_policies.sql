SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'cards'
ORDER BY policyname;
