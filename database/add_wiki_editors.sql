-- Add editors to all wiki folders
-- This grants editor access to Marcel, Sarvan, and Bismark

DO $$
DECLARE
    v_folder_id UUID;
    v_user_ids UUID[] := ARRAY[
        '9f11ef4a-ab34-43c9-9709-d9e241d17c01',
        '402786b2-3f14-4981-93ea-d6aa6492596f',
        '0a2d2c91-3067-4844-9493-feb82538dd8a'
    ];
    v_user_id UUID;
BEGIN
    -- First, make all folders shared
    UPDATE wiki_folders
    SET is_shared = true
    WHERE name IN ('Company Information', 'Company Standards', 'Template Messages', 'Business Model', 'Contacts', 'Miscellaneous', 'Meetings');

    -- Also mark all documents in those folders as shared
    UPDATE wiki_documents
    SET is_shared = true
    WHERE folder_id IN (
        SELECT id FROM wiki_folders 
        WHERE name IN ('Company Information', 'Company Standards', 'Template Messages', 'Business Model', 'Contacts', 'Miscellaneous', 'Meetings')
    );

    -- For each folder, add editor access for each user
    FOR v_folder_id IN 
        SELECT id FROM wiki_folders 
        WHERE name IN ('Company Information', 'Company Standards', 'Template Messages', 'Business Model', 'Contacts', 'Miscellaneous', 'Meetings')
    LOOP
        FOREACH v_user_id IN ARRAY v_user_ids
        LOOP
            -- Insert if not exists
            INSERT INTO wiki_folder_access (folder_id, user_id, access_level)
            VALUES (v_folder_id, v_user_id, 'editor')
            ON CONFLICT (folder_id, user_id) DO UPDATE SET access_level = 'editor';
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Editor access granted to 3 users for all wiki folders!';
END $$;

-- Verify the access
SELECT 
    wf.name as folder_name,
    u.email as user_email,
    wfa.access_level
FROM wiki_folder_access wfa
JOIN wiki_folders wf ON wf.id = wfa.folder_id
JOIN auth.users u ON u.id = wfa.user_id
WHERE wf.name IN ('Company Information', 'Company Standards', 'Template Messages', 'Business Model', 'Contacts', 'Miscellaneous', 'Meetings')
ORDER BY wf.name, u.email;
