-- Wiki Meeting Documents - 2025 (Jan-Dec 2025 and Jan-Feb 2026)
-- Part 2 of 2

DO $$
DECLARE
    v_meetings_folder_id UUID;
    v_owner_id UUID := '62ab2967-f186-4dc5-957c-8c927d58925b';
BEGIN
    -- Get the Meetings folder (should exist from Part 1)
    SELECT id INTO v_meetings_folder_id FROM wiki_folders WHERE name = 'Meetings' AND is_shared = true LIMIT 1;
    
    IF v_meetings_folder_id IS NULL THEN
        INSERT INTO wiki_folders (id, name, is_shared, owner_id, position)
        VALUES (gen_random_uuid(), 'Meetings', true, v_owner_id, 10)
        RETURNING id INTO v_meetings_folder_id;
        RAISE NOTICE 'Created Meetings folder';
    END IF;

    -- 05.01.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '05.01.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "05.01.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Wednesday event organizer will get back to us regarding their weekly meetings"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-52)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-45)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Iza will check if downloading reports from Stripe is possible."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-72)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-16)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-46)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-17)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "1140 PLN for ads scheduled for January."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-47)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Video and photo session planned for next Sunday; Marcel will confirm the arrangements."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The team will check the branding options."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-36)"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Football Event Offers:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "500 PLN budget."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hydration/water dispenser for participants."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "A 10% service discount for the top 3 teams."}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Damjan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Review monthly and mid-year goals, general structure and strategy."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Football sponsor ideas"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Payment button option, pay link in inbox option."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "LinkedIn Status"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "CRM, workflow and tasks systems showcase and decision"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Colors updated, went through links, majority works, and colors fixed."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hiring. How many CS, how many legal."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ads, cycle 2. Tiktok and instagram only?"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Communication for/with employees (whatsapp, messenger, discord)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Whatsapp to wix inbox migration."}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sarvan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Website fixes - fix the hover over color"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Website slide show"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Football tournament"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Fotos and videos"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Referral program"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Losing clients over email - lets not hesitate to text them on whatsapp"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 19.01.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '19.01.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "19.01.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-48) and Private (MGMT-53)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-49)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-63)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-38)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "It was agreed that football event investment will be increased depending on FAMI response"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Customer communication will be assigned as follows: 08:00 to 16:00 - Damjan, 16:00 to 00:00 - Sarvan, 00:00 to 08:00 - Bismark"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan will structure tiktok ads and get back to team"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sarvan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Follow up tasks +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Football event investment +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Price changes? +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "More cooperation with companies (Linguacity, Wellcome home)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Social media content creator intern / SEO intern +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Installments +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Whatsapp recovery"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Damjan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Interns status"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Specific requests vs consultation"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Service focus"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Customer Service/Legal support"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 02.02.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '02.02.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "02.02.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Meeting Agenda Implementation"}, {"type": "text", "text": " – Going forward, everyone must prepare an agenda before meeting and add to click up"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Tagging in messenger/taking ownership"}, {"type": "text", "text": " – Ensure to tag relevant team members when assigning tasks or requiring input."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-59) and Private (MGMT-64)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Job Aid Assignments:"}, {"type": "text", "text": " Private (MGMT-18)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Google Drive Usage"}, {"type": "text", "text": " – Ensure proper organization and utilization"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Image Replacement"}, {"type": "text", "text": " – Private (MGMT-65)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-19)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Business Outreach"}, {"type": "text", "text": " – Bismark to enhance efforts in finding and contacting companies."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Client Follow-Ups"}, {"type": "text", "text": " – Follow up with clients one week after service"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Reservation System"}, {"type": "text", "text": " – Discussion and implementation in future"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "New Schedule:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "10:00 to 14:00 - Damjan"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "14:00 to 18:00 - Sarvan"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "18:00 to 22:00 - Bismark"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Damjan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Meeting preparation/agenda"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Active availability updates"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Internship offers status (visuals/facebook/linkedin/pracuj)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Logo tweaks then update everything"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Files to google drive"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Images on blog posts"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Prices/services/scope"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "New companies found/reached (needs to be ongoing)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tracking converted cases (for future tax needs and for Iza)"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sarvan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Repeating questions to customers +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Form for each service before forwarding to Marcel +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Follow up with clients ++"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "4 different interns +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sample email to be sent rate your experience after each customer support +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Reservation system for consultation, online payment right away"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Price chart visuals +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Services in website +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Football event"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- February 2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        'February 2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "February 2025"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sarvan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Market research (p)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tax in stripe - Marcel will have a meeting with Iza"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Work schedule management sling or connecteam +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Communication tool Google Chat/meet or Clickup +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "About us page (p)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Revising vision and mission (p)"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Damjan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "CRM/chats currently in wix (request, chat, email, instagram, facebook, whatsapp)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Calling needed, direct to number vs WhatsApp discussion."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tracking customers and cases (potentially click up)."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Chat and main hub for employees (currently click up)."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Freshworks - Has several products/bundles to choose from (Has option to call customers. Track tickets and accounts.)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hubspot (CRM + calling features)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Wix transferred fully to connect@foreigners.pl including subs for premium and email+"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Upgraded wix plan to Business plan (initially $70+ more expensive) for free+"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Zapier(zaps) integrated stripe payments with clickup chat using zapier api +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Click up premium +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Meetings time during week (due to interns)+"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-9 through MGMT-15)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Google drive clean up + expenses folder +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Email/message communication with clients + Bismark will include in training"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Communication channels/chats and handling + one chat only (plus one for board)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Payments handling for CS +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Training presentation overview +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Phone situation + put 2 numbers until we get tmobile numbers hub"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tools accesses +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Shift setting on sling (for monday for training showcase) and shift agreement +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Call consultation with marcel how to arrange +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Payments - Klarna? + Sarvan to remove"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Payments google and apple pay + no google pay through stripe"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ewa update +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ads plan? what ads we will run, what sm, how much money daily +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Meetings with employees, where, how, do we want to introduce them to each other? +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Communication from client while case is with legal? + lawyers can use emails only to communicate through click up."}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Marcel:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Internship options (Ewa)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Follow up to Nikola"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Bismark:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tournament campaign (p)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Discount and Loyalty program - bismark will prepare some extra discount templates"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 03.03.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '03.03.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "03.03.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan to schedule meetings for every wednesday and sunday"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-124) and keep track of costs"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Zapier to be paused for now and manual labour will be used"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "We will need to move from sling to connecteam, Private (MGMT-125)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-126 through MGMT-132)"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "New Operational Structure (3 month trial):"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "CEO/Head of operations/Law/HR - Marcel Wieczorkowski"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sales & Marketing/Project Management - Sarvan Najafli"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Customer Success/CFO - Bismark"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "CTO/Reporting & Analytics - Damjan Zdravkovski"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- March 2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        'March 2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "March 2025 Meeting"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Meeting Minutes:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-133)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-134)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-135)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-136)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-137)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "1x1s to be conducted by marcel weekly"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-138)"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 19.05.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '19.05.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "19.05.2025"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sarvan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Video consultation"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Car registration price?"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Facebook pixel, to analyze who is going to website and how many"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Website analytics"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bank transfer discount"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Monthly customer and income analytics, so we could prepare goals for upcoming month"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Damjan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Customer Experience (from ad to website, and website structure. Form. One default on home page, and one per category, one per service, one singular for everything)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "ClickUp Structure (everything in one list vs few lists? in list, status with purpose for it, exact tasks for each status before moving it to next status)"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Marcel:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Meta invoices"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "New business opportunities"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "New person in team"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "PIT CLIENT FOLLOW UP"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ask Iza to send us the agreement for cars"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Check the amount of invoices with Iza"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Schedule an appointment to sign the documents for Iza and tax office"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 08.07.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '08.07.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "08.07.2025"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Meeting Minutes:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark will reach out to Gideon to talk in african language"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Colombian team cases still ongoing"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marketing budget for this month to be 500 pln for the month of July"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Nostrification ads to be paused"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Going forward customer success will be making calls after consultation"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Email template for consultation not with canva design but email"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Missing invoices to be uploaded"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 29.10.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '29.10.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "29.10.2025"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Damian to start taking meeting minutes and assign tasks based on meeting agreements"}]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 31.10.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '31.10.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "31.10.2025"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Day to Day"}]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Bismark:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "2 potential clients for trc expedite in ktw"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Another client as well once she is back on 20th november, to follow up then"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Marcel:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-149) (first third)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-151)"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Damjan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-150) (CRM)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Will be facilitating meetings and notes"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Sarvan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Japanese guy provided the number finally, Marcel to have a free consultation with him for a potential cooperation on a bigger level. He is bringing japanese people to poland for sports."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Monday we do monthly briefing"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan to arrange photo session for our website founders/about us page"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Business Development"}]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Bismark:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Campaign of awareness to know that there are many scam companies promising to do services but arent. Awareness campaign to be ran to improve the clients trust with us."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-152) The driving school to bring us clients for tutoring and for the legal process. On tuesday Bismark will talk to the person in charge."}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Marcel:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Have a day in Warsaw initiative, where Marcel is present in warsaw in person once a month or twice a month for consultation in person. Private (MGMT-153) Agreement is to register a company there, and have a place to rent on need, and market in warsaw."}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Damjan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-154)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-156)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-157) Alternate with Sarvan and Bismark."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-159)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-160) beginning of December."}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Sarvan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marketing katowice locally for in person meeting. Check offices in katowice, same as warsaw project above."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-161)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-162)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-163)"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 03.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '03.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "03.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan and Bismark did their presentations. Damjan didn''t. Presentations moved for Wednesday meeting."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark suggested to reduce stripe costs. It is 3%-5% per transaction. Letting client pay, or changing providers for now its not an option. For now, offer bank transfer on transactions, and if its a bigger payment, and client isnt sure if they wanna pay by transfer, offer discount that would be less than the cut that stripe takes."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark meets me Thursday around 2pm? confirm time after meeting."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel and Bismark go to the driving school Thursday 16:30pm."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel struggling with moving case from Katowice to Krakow for a TRC Expedite, currently waiting for the officer from Krakow. Marcel is meeting them tomorrow 10am."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Japanese guy 1:45pm meeting tomorrow with Marcel."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Kebab guy is still in hospital in Istanbul."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel showed few different office options. One owner for both Katowice and Warsaw offices, wants to get 12-15 hours on each, for 300pln gross total. We can put metal plates of our company on the office."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Had an idea to revive an old idea mid meeting, do online webinar. Promote free webinar for foreigners and their stay in Poland."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "No advertisement campaigns running at the moment. Waiting for the offices and everything to settle."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 05.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '05.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "05.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Discussed the office offers. Initial communication they tried to offer us premium packages with features we dont need. Later discussed for 440pln to get katowice, warsaw and lodz with 30-40 hours flexible between the 3 location."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Adding forms for processes on website. Get everything from https://przybysz.duw.pl/en/documents-to-download/ and put it on our website."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel prefers to have 1-3 days notice. Temporary agreement is mon-wen-fri 5-7pm"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Japanese guy is 50-50 on smash/pass. He said he will reach back to us by the end of this week."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Poznan daily idea, 150pln to write an article on poznan daily. We need to send a response to the person that reached out to us. Sarvan to reach out."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Monthly presentations, Marcel didn''t have it again, 3th month in a row. Praying to the gods that one of the next months we will have the honor to witness a Marcel presentation."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 07.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '07.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "07.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Talked about the ongoing tasks in the board, agreed on follow up dates for some of them, check tasks for more info"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Talked about perfumatik, agreed to discuss more about it on wednesday meeting 12th november"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 10.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '10.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "10.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark thanked Sarvan for invoice input"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark and Marcel agreed to go through monthly invoices on wednesday 12th november"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Njemuwa is coming back in december, he said he will start the process once he comes back"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Business request guy on email, sent invoice, said he will let us know as soon as he makes the payment, happened on the 4th November, valid for a month (the invoice). Send follow up email by Friday."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan to send invoice for 1000zl to indian guy"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel wants Wiktoria''s friend or a black chick, or he is going to Vietnam"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan cost-cutting with ChatGPT from plus to go, going from 99.99zl to 34.99zl"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan suggest to add some sort of time frame on the ads to attract clients, like \"get your biometrics within 3 months\" for example. 3 months trc on average agreement for now, just dont promise."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Wednesday will be online, moving in person meeting to next wednesday 19th November."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 12.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '12.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "12.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark wants 5 minutes after this meeting for invoices, Marcel said no problem"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "No one still used vouchers from the football team. Consultation with 1-2 but no one used it for actual full service. Discussed, points were made that we are making an expense for ourselves with no reason to, but also points were made that next year we don''t want them saying that we scammed them the year before. Bismark will draft comms and show us on Friday."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan got call from supremes, they cant do the same speed in ktw, and 7 days fingerprint no longer valid due to government changes. Sarvan asked so what could they do for him in ktw, they said they will call him back tomorrow."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Intern email, to respond with explaining that its generally virtual so she can work from any polish city, it is unpaid, and we can fill out her hours for uni if needed. Sarvan will reply."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Whatsapp changes, username instead of number. Follow up later, in 2026, around end of first quarter."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 14.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '14.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "14.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Went over ongoing important tasks"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan suggesting to go under fake names when chatting with clients, especially women names due to people trusting talking to women more"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 17.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '17.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "17.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Covered the important ongoing tasks"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Checking if we can register a car/motor in poland without physically bringing it to Poland, Bismark asked Marcel. Marcel said its possible, but it might be rejected. Marcel said to register a car, u have to be residing in poland. Price agreed 3k for everything, and we pay for the inspection from that money."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark presented email draft for Columbians vouchers, board approved, Bismark to send tomorrow 18th."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark wanted to gatekeep our company budget, due to lower expenses this month, but more expenses in following month due to office rentals. Starting 300pln budget until offices respond."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "\"Reloc\" doing presentations for legal processes for foreigners/students. To get in contact with Ali, and attempt to have him arrange a seminar in person at the university presenting processes and services overall."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Business incubator reached out on instagram, Sarvan shared, 500zl commission per client we bring them."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "How to fix false negative opinion on foreigners.pl on AI platforms - Damjan to try and figure out a way to fix"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Pay Ali 15% for the clients he brings us."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    RAISE NOTICE 'Added 2025 meeting documents (Part 1)!';
END $$;
