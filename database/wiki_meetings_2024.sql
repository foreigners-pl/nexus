-- Wiki Meeting Documents - 2024 (Sept-Dec)
-- Part 1 of 2

DO $$
DECLARE
    v_meetings_folder_id UUID;
    v_owner_id UUID := '62ab2967-f186-4dc5-957c-8c927d58925b';
BEGIN
    -- Get or create the Meetings folder
    SELECT id INTO v_meetings_folder_id FROM wiki_folders WHERE name = 'Meetings' AND is_shared = true LIMIT 1;
    
    IF v_meetings_folder_id IS NULL THEN
        INSERT INTO wiki_folders (id, name, is_shared, owner_id, position)
        VALUES (gen_random_uuid(), 'Meetings', true, v_owner_id, 10)
        RETURNING id INTO v_meetings_folder_id;
        RAISE NOTICE 'Created Meetings folder';
    END IF;

    -- 22.09.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '22.09.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "22.09.2024"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "First monetization attempts:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Legal consulting and translation assistance in Katowice office"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-20)"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Tasks:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Website updates on foreigners.pl (Damjan)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-21) (Marcel & Sarvan)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "One article a week for foreigners.pl (Bismark)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-22) (Bismark)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Assist with translation and legal services for TRC requests coming from Foreigners.pl (Marcel)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-23) (Marcel)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-24) (Marcel)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Blog posts for foreigners.pl (Bismark)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Website improvements (Damjan)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Actors for social media content (Sarvan, Bismark, Marcel)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Create scripts, record, and edit social media content (Damjan/Sarvan)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Manage social network profiles, track analytics from social media (Sarvan/Damjan)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-26) (Marcel)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Get the shit and health together (Sarvan)"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 4.10.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '04.10.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Meeting minutes 4th Oct 2024"}]},
                {"type": "orderedList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Social Media Management:"}, {"type": "text", "text": " Sarvan will be responsible for posting on each platform once a week, starting from October 7th."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "T-shirt Design Offers:"}, {"type": "text", "text": " Damjan will reach out to companies that have been identified for t-shirt design and will prepare the proposals."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "AI Integration for Website:"}, {"type": "text", "text": " Damjan is working on AI integration, which is the priority task for the website."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Service Pricing Research:"}, {"type": "text", "text": " Bismark will research pricing for services."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "FAQ Section:"}, {"type": "text", "text": " Damjan is progressing with the development of the FAQ section."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "ClickUp Task Management and Automation:"}, {"type": "text", "text": " Sarvan will work on organizing ClickUp more efficiently, focusing on task management and automation."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Duplicate Phone Number:"}, {"type": "text", "text": " Bismark will purchase a duplicate phone number."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Brand Kit Proposal:"}, {"type": "text", "text": " Sarvan will propose and provide offers for potential brand kit expenses."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "ClickUp Upskill:"}, {"type": "text", "text": " An upskill session on ClickUp will be conducted next week for 4 team members."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "LinkedIn Profile for Foreigners PL:"}, {"type": "text", "text": " Sarvan will create a LinkedIn profile for Foreigners PL, at least to reserve the name for now."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Target Cities Research:"}, {"type": "text", "text": " Sarvan and Bismark will research potential target cities in Poland."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 17.10.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '17.10.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "17.10.2024"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Congrats! We have had our first customer today!"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Decided as business model as a one-stop shop, where clients reach out, and we connect them with the appropriate expert."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan will handle website updates"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan will handle social media"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-111)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark will Private (MGMT-98)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel will handle legal integration"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel will also Private (MGMT-73)"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 01.11.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '01.11.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "01.11.2024"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-84)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Profiles: Each team member will create two profiles to interact within groups"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-117)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-74)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-75)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-100)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-99)"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 09.11.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '09.11.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "09.11.2024"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ads Budget: 100 PLN for ads in India, Pakistan, Philippines, Colombia, Mexico, Guatemala, Ghana, Nigeria (proof of accommodation), Georgia, Azerbaijan, Vietnam, and Turkey."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Free Consultation Ad: Allocated 100 PLN."}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Action Items:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Group Updates: Everyone to post"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Business Plan Template: Private (MGMT-27)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Stripe Account: Setup"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Photo Session: Private (MGMT-28)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Website Address: Update"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Social Media Updates: Various platforms"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Form Submission Note: Add note"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-115)"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 16.11.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '16.11.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "16.11.2024"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "First customer through website on 15th November"}]},
                {"type": "orderedList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Tech Company Appointment:"}, {"type": "text", "text": " Private (MGMT-85)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Photo Session:"}, {"type": "text", "text": " The photo session has been postponed to February."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Foreigners Business Group:"}, {"type": "text", "text": " Private (MGMT-89)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Pricing and Financial Framework:"}, {"type": "text", "text": " Iza will provide pricing details for the business. Private (MGMT-86). Iza will prepare an Excel framework for financial organization."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Invoicing Platform:"}, {"type": "text", "text": " Private (MGMT-76)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Google Drive Link:"}, {"type": "text", "text": " Private (MGMT-29)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Stripe Account:"}, {"type": "text", "text": " Private (MGMT-112). Private (MGMT-30)."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Disappearing Form Confirmation:"}, {"type": "text", "text": " Fix needed."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 26.11.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '26.11.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "26.11.2024"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Agreed on a 5k budget to start with TikTok advertising"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-101)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-71)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Mobile Optimization: The mobile version of the website will be a primary focus."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Share Button: Add to website"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Partner Page: Create"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Job Listings Page: Create"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Image Usage: Ensure all posted images for articles and facebook will be created by gemini"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-57)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark will send job listings from facebook groups to Damjan whenever there is one."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Email Archive: Private (MGMT-31)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Email Signatures: Setup"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "ClickUp Templates: Private (MGMT-32)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Stripe Account: Private (MGMT-33)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Iza Payment: Private (MGMT-77)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Fakturowna: monthly subscription for 10 pln is agreed"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 30.11.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '30.11.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "30.11.2024"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sarvan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Taxing on Stripe - checked options, better than faktorownia, 0.5%. Change the plan to stripe taxing. Private (MGMT-78). ++"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Meta verified seems to be available, test for a month? ++"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Bismark:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Business Plan. Private (MGMT-102) ++"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Damjan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Privacy Policy and ToS finalized +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Added Business and Jobs category - feedback +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "In business category, missing offers for help to create a business, based on business type etc. - Private (MGMT-79) ++"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Reaching out to companies that hire foreigners - Private (MGMT-40) ++"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Another google campaign + contacting law students/putting a list together, Private (MGMT-41) and Private (MGMT-90) ++"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 08.12.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '08.12.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "08.12.2024"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sarvan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Brand color adjustment on red? to #AB1604"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Referral program"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "December plan and operations"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Quarterly or monthly goals"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Commercial tiktoks starting january"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Stripe tax email"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Marcel:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Talk about lawyer representative options"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Bismark:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Share options on articles"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Weekly update"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Damjan:"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Footer Revamped (show)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Careers list and careers item page (show)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "List of potential companies, needs to keep expanding"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Send emails to companies that maybe or provide immigration offer for international employees"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Once agreed with companies, request their job offers and post listings on our website"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Start advertising job offers"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Potential Full immigration package with discount if taken as a whole, especially for companies, but also for individuals (work permit process, pesel, TRC application, Biometrics, translation for any/all of that)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Business plan filled out by Bismark? final touches if needed"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Meeting minutes 8th December"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-80)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "TikTok commercials will launch in the second week of January."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark will start writing a new article for the news section."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Gather data on companies hiring foreigners using ClickUp."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark will carry on reaching out to job applicants and employers."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-103)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-104)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Set monthly goals starting in January."}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "June 2025 Goals"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Achieve 3 lawyers per city by the end of June."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Reach 50k PLN in revenue by June"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "TikTok: 25k followers"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Instagram: 2.5k followers"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Onboard 3 companies for job listings."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Organize at least one in-person event."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Secure at least 5 clients per city."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Aim to come as close as possible to applying for a grant."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Target a 50% profit margin."}]}]}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Utilize quick replies for more efficient communication."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Instagram Visual Ads"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 15.12.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '15.12.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "15.12.2024 - Meeting minutes"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-106)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan created an Excel file with costs. Please play around with the financial file and consider percentages."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The ad investment for next round will be 680 PLN."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "We aim to hire 2 lawyers per city"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "We''ll set up an internship for lawyers through LinkedIn."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark will follow up with Marko on Messenger to discuss further."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-87)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-43)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-88)"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sarvan"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Customer service standards (we instead of I, use name whenever applicable, say hi back or good morning, greet customer, dont unsend message, space between sentences) any more ideas? read receipts? lets not leave them hanging +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Go through tasks in click up"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Price negotiations topic, if we lower then let''s ask them to do something (twerk) +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Reservation system for appointment in website follow up"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Possible crm tools +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Possible financial analysis tools (datarails) +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Slide show at home page with main services +"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Facebook posts - labor code changes legalis pl"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Bismark"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Russian guy reached out, what do we do"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Damjan"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "https://www.foreigners.pl/?rc=test-site"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Go over entire file 2024"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Financials and projections testing and agreement for at least next 2 cycles"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Missing requests info Bismark"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Mandatory info from every new customer"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Conversation with Ewa, how did it go?"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hiring Process & contracts"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "First round hiring plan and structure"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Utilizing the students, communication and structure"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ads investment plan (period per cycle and amount in %)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "LinkedIn job offers"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 22.12.2024
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '22.12.2024',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "22.12.2024"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Blue card is already on website"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Keep 7k on account, if needed for ads or similar costs, drop limit to 5k"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ewa is interested in putting more than the initially mentioned 30 hours to help us. We need to consider of what nature the arrangement will be."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hiring interns is faster and simpler than employees. Marcel has familiarized himself with the process."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Scope of interns - Sale attempt, once confirmed generate payment link, then refer job to lawyers to do documentation or if in person is needed. Then back to customer support to wrap up the case."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-35)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel will have short meetings with interns covering how to fill out different forms, so they can help out with documents"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-50)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-51)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-68)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Football event sponsoring - meet 23rd December 2024, offer help, ask what they would need. No plans to invest money for now. ROI makes it not feasible."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Customers wanting to meet in person, or wanting to call us - until we have offices, no in person unless needed help in ministry"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-69)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-37)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-82)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Private (MGMT-44)"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    RAISE NOTICE 'Added 2024 meeting documents to Meetings folder!';
END $$;
