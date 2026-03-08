-- Fix Wiki Import Ownership
-- This updates all imported wiki folders and documents to be owned by Damjan

-- =============================================
-- STEP 1: First run this to see all users
-- =============================================
SELECT id, email, raw_user_meta_data->>'full_name' as name 
FROM auth.users
ORDER BY email;

-- =============================================
-- STEP 2: Copy your user ID from above and paste it below
-- Then run the UPDATE statements
-- =============================================

-- Replace 'YOUR_USER_ID_HERE' with your actual UUID from step 1
-- Example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

DO $$
DECLARE
    v_damjan_id UUID := '62ab2967-f186-4dc5-957c-8c927d58925b';  -- <-- PASTE YOUR USER ID HERE
BEGIN
    -- Update wiki folders to be owned by Damjan
    UPDATE wiki_folders
    SET owner_id = v_damjan_id
    WHERE name IN ('Company Information', 'Company Standards', 'Template Messages', 'Business Model', 'Contacts', 'Miscellaneous', 'Meetings');

    -- Update wiki documents to be owned by Damjan  
    UPDATE wiki_documents
    SET owner_id = v_damjan_id
    WHERE folder_id IN (
        SELECT id FROM wiki_folders 
        WHERE name IN ('Company Information', 'Company Standards', 'Template Messages', 'Business Model', 'Contacts', 'Miscellaneous', 'Meetings')
    );
    
    RAISE NOTICE 'Wiki ownership updated to Damjan!';
END $$;

-- =============================================
-- STEP 3: Verify the changes
-- =============================================
SELECT wf.name as folder_name, 
       u.email as owner_email, 
       wf.is_shared,
       (SELECT COUNT(*) FROM wiki_documents WHERE folder_id = wf.id) as doc_count
FROM wiki_folders wf
JOIN auth.users u ON u.id = wf.owner_id
WHERE wf.name IN ('Company Information', 'Company Standards', 'Template Messages', 'Business Model', 'Contacts', 'Miscellaneous', 'Meetings')
ORDER BY wf.position;
