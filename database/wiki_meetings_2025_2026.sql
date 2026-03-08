-- Wiki Meeting Documents - Late 2025 and 2026
-- Part 3 of 3

DO $$
DECLARE
    v_meetings_folder_id UUID;
    v_owner_id UUID := '62ab2967-f186-4dc5-957c-8c927d58925b';
BEGIN
    -- Get the Meetings folder (should exist from previous parts)
    SELECT id INTO v_meetings_folder_id FROM wiki_folders WHERE name = 'Meetings' AND is_shared = true LIMIT 1;
    
    IF v_meetings_folder_id IS NULL THEN
        INSERT INTO wiki_folders (id, name, is_shared, owner_id, position)
        VALUES (gen_random_uuid(), 'Meetings', true, v_owner_id, 10)
        RETURNING id INTO v_meetings_folder_id;
        RAISE NOTICE 'Created Meetings folder';
    END IF;

    -- 19.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '19.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "19.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Spoke about registration of vehicle client."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark wanted to know how warsaw consultation scheduling will go. Agreed that we will agree for each week whats the warsaw day that marcel will go there, and clients that want consultation Bismark will schedule them for that day."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark will talk with Marcel about warsaw business trip arrangement and expenses."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "We received rejection for Collin''s case. Marcel said there was confirmation that Collin already received negative decision, and Collin hasn''t informed us."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ads agreement: Warsaw, Language School to start running. Katowice paused until january. Driving/Business registration to be ran based on Bismark''s outcome meeting the guy on 20th."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 24.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '24.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "24.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Meeting platform, reach out to wix to see if they have classroom as part of google workspace sub"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Blik to figure out how to show it on normal invoice payment. Shows as activated, but doesnt show on payment page."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Stripe invoice to figure out custom payment method as bank transfer. And custom invoice for company payments."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Warsaw trips will be by train, 200pln round trip. If train not available, 280-320pln for gas with car. Bismark wants to pre-budget those expenses. Agreed."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark had false info that everything is on hold till March. Marcel called bullshit. What is on hold is the rules that cases cannot exceed 60 days."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan suggests to have one trip all together to Warsaw."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel to tell Ali tomorrow about the seminar idea, and explain Ali''s role in it. Promo code for 50/100pln voucher for attendees, and 10% for Ali from the post VAT amount. Umowa o dzielo for future payments."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Language section on website to be refined, include language course specifically. Use keywords from insta posts."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Website reviews to be embedded from google."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel wants to invite him for an interview on Wednesday 26th November. Damjan to schedule it."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan invited us mfs to his bday, 18th or 19th, waiting for confirmation."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 28.11.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '28.11.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "28.11.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel to inform the business registration guy that we cannot accommodate his request to provide employment and pay him from his own money etc."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel needs to prepare expedite for visa indian guy, but turns out every visa procedures in countries with high risk list, visa procedures are stopped. He will still do it, just in case."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Will submit files for Sheetal on Monday"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Waiting for confirmation for Warsaw clients, from Marcel''s sister friend and her boyfriend. One consultation but potential TRC for 2 people."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan will boost trc in warsaw for today and the weekend"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "To talk about budgeting on Tuesday"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan spoke about language clients, and their needs and requests"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan explained classroom from google needs a paid domain for the email, and its 3$ per person."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark suspects one client might be scam or good opportunity, Damjan and Bismark to talk about the case"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan suggested build groups and offer prices for a group when you have already at least half people."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel and Adrian need to talk about the contract and how its gonna work."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel and Damian to have interview with the teacher that sent us CV. Damian to reply to his email and ask for availability for next week."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel informed the board about the intern interview and the plans. After the initial month, if he is ready, to propose for commission."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan looked into badges, 5zl for the badge itself, no lanyard checked yet but shouldn''t be too expensive."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 02.12.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '02.12.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "02.12.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "First TRC Premium client, from Italy, through Erasmus, wants to transition his card. We want to offer him a referral proposal. Marcel to find options how we could pay him. 15% with our current pricing, 10% if we change prices."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan and Marcel to meet with language teacher at 12:00 Wednesday 3rd. Damjan to send email today after meeting."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Talked about language project, went over current potential students"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Showed state of CRM tool"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan showed badge, asked for images from rest of us, to make them into AI for the badges. Sarvan got the price wrong for badges, its not 5zl, its only for large order. No individual options for 1 badges or few. Minimum 50 on most places. Assumes 20-30zl per badge."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "In terms of immigration ads for Warsaw, to have 1 just ad (not post on profile) with mentioning Warsaw, such as \"Are you in Warsaw, and have issues with X\". To show Marcel before running."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark to make list of companies with similar services to us. Time to do market research in order to adjust our pricing."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan to talk to wix about pricing"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan to look into custom website possibility, mobile view, SEO, blog posting ability"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 05.12.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '05.12.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "05.12.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark went to driving school guy, he asked him next week to bring the contract for signing. He said he is open to put us on his website. Asked to send him our website. To ask him to make the final decision."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 08.12.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '08.12.2025 (Dec)',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "08.12.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark asked for the invoices so this wednesday he can go over them with Marcel"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Everything covered from Marcel side, just to inform Janek that we will start from Wednesday"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark interrupted if Marcel can meet with Alex for 5 mins after our meeting"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark tomorrow to follow up with Japanese guy that Marcel met in warsaw office"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Higher budget language ads to be shortened to friday with same budget (more per day) and lower budget to be extended till friday with the 20pln remaining for language ads."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 10.12.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '10.12.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "10.12.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan put 2 logos in drive. Cook initial partners section on website"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Mobile version logo not aligned, needs to move left"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Move year from 2025 to 2026 at the bottom of website change"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Change address at the bottom to correct one"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Menu to fix on mobile"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Others pretended to be busy cuz they hate me"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tried first time email campaign on wix"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan finally liked SEO numbers/results xD"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel asked if all invoices were submitted, agreed with Bismark to meet tomorrow to go over them"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Shit All has installment to pay"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Car registration service organic interest, 3 people showing interest on Whatsapp. Potentially to put this service on BLAST, if those clients convert well and we think its worth it"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tomorrow Marcel has first main meeting with Janek from 2pm"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Cases are going good, Marcel has most things handled"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Issues with guys cases, withdraw current transfer request from ktw to krakow, transfer case for other guy from krakow to ktw, once they are both in ktw cases, submit expedite. Marcel suggested 599pln per person to do their cases in ktw after transfer + withdrawal."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Service pricing, file is on drive. Bismark will upload list by tomorrow. By Wednesday each one of us to reach out to few, see how they work, and obtain their TRC pricing and offers."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark raised our refund policy to question. Marcel will call Iza Friday. we then need to revisit our policy."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Talked about marketing and trying to track costs and acquisition. Cost per Contact, Cost per Sale, and from that Return on Investment."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 12.12.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '12.12.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "12.12.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark brought refund topic again. 100% discount would be if there''s an issue caused by our company, that wasn''t influenced by the client, what the client said or the truthfulness of their word and documents. If client changes their mind after paying to us, and its within 24 hours, and we have not filled or submitted any documents from our end, we can give them up to 50% refund, depending on how much work has already been done regarding documents review and research."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Driving form was in junk, Sarvan moved to inbox, Bismark saw and texted"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan reached out to all partnership people"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Iza had urgent situation, so postponing contacts to her"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark has put the list of companies similar to ours on google drive, and will share the link in our messenger group"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 15.12.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '15.12.2025 (Dec)',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "15.12.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel had convo with Iza. We need to schedule a call with Adi. Marcel can call him tomorrow, to explain to him how the b2b will work. We pay his creation 360pln, he pays the monthly 360pln from the students he has."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel mentioned Iza said she hasn''t started our zus yet, and we should leave it like that, its better to do b2b instead."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel said refunds no problem, we just send the money back, and even if money came from account A and we return to account B, we just need to mention it in the description."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "New invoices, that will be used only between companies."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Remove \"remote/virtual\" support mentions on instagram and on locations section on website in \"other\" locations."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel shared that his new girl might have seen messages from Sandra and her on netflix and might be suspicious even though nothing is going on."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Groups to start every 15th of the Month, once a month."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Communication with language clients and meetings/ppts to be split between all 4 of us."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "After form submission, have a message telling them they dont have to wait, they can get to us on whatsapp."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan asked Bismark whats up with Viktor''s communication, Bis forgot. Bis to write today to him."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "17th online meeting. 18th, 6pm at Sarvan''s place."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 17.12.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '17.12.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "17.12.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan planning and will write as many scripts as possible for videos in Warsaw."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Once January marketing strategy is built he will start releasing them."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Last time video ads were about law changes, this time it will be purely focused on our services."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Wants a girl to be in the video to increase trust from viewers. Professionals could be costly though. Asked Marcel about groups (facebook) where people are looking for gigs like that. Marcel shared influenser polska group on facebook."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel had the PRC appointment with a client, client is very demanding, Marcel wants to finish asap to not deal with him. He said in his company there are other foreigners, and if he is happy with our services he will suggest us to the rest."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Anas paid first installment, but Marcel had to figure out the way to offer him us to handle his case as representative."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark asked Marcel if we can pay the Iza shared expenses (VAT/CIT)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark talked about contacting other competitors and pricing etc."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "For pricing conversation Sarvan didnt check yet, he will do all on Monday"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan to make the partners section on website by Friday so Sarvan can use it in communication with other potential partners"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan proposed service for Tax consultation, to come back in January potentially, and make that service"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan suggesting to prepare yearly summary file, for our own needs but also for outside to have some numbers gathered."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 29.12.2025
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '29.12.2025',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "29.12.2025"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Once Bismark starts work, if a new client after 15 minutes are not assigned to Bismark, someone else can take it instead. On AHOD days, we all jump and handle the wave of clients. If language clients need to have the meeting at 5pm or before that, then someone else has to do it. Bismark can only do it 6pm and after. As backup, if 15 mins not responded to a new client, until 12 noon Damjan, 12 to 3 Marcel, 3 to 6 Sarvan."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark asked Marcel for update on Shital so he can ask for payment. Also for the Bismark client, for which Marcel has to first come back to Ktw."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark got a call on our company number today, from a lady looking for a job, she lives in ktw. Bis mentioned being sales executive to her, she said she liked the opportunity, he told her to send CV to our email. Bismark bullshitted her that he will talk to HR xD. If email comes, Marcel to have a look, and arrange a potential interview. Bismark said she is Polish."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan proposed to start paying ourselves something. Mainly legal and sales, and secondary marketing and IT. Marcel proposed 30% for legal. Bismark to make calculations until 2nd of Jan, for that meeting."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan asked about website and wix ending subscription. Damjan explained new website is already hosted, just wrong domain cuz its still on wix, Damjan and Sarvan need to meet for domain aftermarket thing."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark was being political af again, in terms of catalogue if it should have prices or not. Bismark agreed to have the price removed, Sarvan to come up with ideas on what to put on the catalogue image."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan asked of the ratio of consultation not converting to a full service afterwards. Marcel said about 60% convert to a service after consultation. To start checking reasons why some consultations don''t follow into a different paid service."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 02.01.2026 (originally labeled 02.01.2025 in source)
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '02.01.2026',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "02.01.2026"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan asked about accounting, saw some potentially better offers on google. Marcel to research different options to reduce our costs for accounting."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan to figure out Vercel and Supabase costs in case we pass free tier"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Agreed on percentage splits"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Videos shooting for Warsaw once Marcel comes back and then he has a warsaw day so we all go together"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sunday shooting 12pm Sarvan, Bismark, Damjan (to bring gimbal)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Meetings to be tuesday, thursday and sunday, from 8pm"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 06.01.2026 (originally labeled 06.01.2025 in source)
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '06.01.2026',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "06.01.2026"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Prices topic closed for now. To come back if we see a need for any other service price change"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tax service to be revisited on 15th of February, when ePit starts."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel went through the accounting options for us. Bismark said anyone 450 and above not worth to change cuz similar price to Iza and we already have a relationship with Iza. Marcel to check with the cheap one 249(?) to see the reality of the offer."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan asked regarding the paid university interview we had, the payment and also they proposed another one, so could we do it again. Marcel will check the possibility of doing it again."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan asked about the 2nd teacher guy, Damjan explained he is b2b, and charges hours at the end of the month, his rate 100 preferred."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan mentioned emails coming, not organized, he keeps organizing but it keeps getting messy."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Poznan articles invoice needs to be paid. Marcel said he will pay it. Sarvan to send him QR codes."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark showed projected expenses, planning for budget. Planned 900 for warsaw trips as well for January."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marketing 1000pln total, 400pln for immigration, 400pln for language, 200pln for driving license. Agreed."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Next meeting we do mainly presentation for language, and short meeting, only urgent things."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 08.01.2026
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '08.01.2026',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "08.01.2026"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Price on ppt for languages to be added monthly (installment amount) how many months, and then total."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Add enrolment fee in the level pricing showcase, explain it needs to be paid up front to be counted for the group. Client has 2 days from the meeting to pay the enrollment fee, to be counted for that group. Of course if they don''t, and come back later, we allow them to join, as long as they are willing to pay."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "If less days until the start date, then provide less time for the enrollment fee. If they contact 5 days or less before the start date, then they pay the first installment in its entirety, including the enrolment fee."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Agreements to be included with that payment. Sent to them, signed, and sent back to us. (email) Damjan to give Marcel the draft from linguacity."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Price to be split in installments, then take away 99pln (enrollment) from the first installment, making the first installment looking cheaper. Start date each month on 20th."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Agreed to add label to conversations before even starting to write, so we don''t double write, or draft then see someone else message. First label, then start writing, no exceptions. Everyone said yes except Bismark. His silence is counted as confirmation."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 03.02.2026
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '03.02.2026',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "03.02.2026"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Iza finally answered. Agreed on website partnership. She will send us logo materials and we need to send it to her."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Our cost, 540pln net, from now it will be 390pln after we provided her monthly client."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "PIT service will be provided to us with discounted price. Price to be on email. Our cut on top will go to her, she will deduct our invoice by this amount. If the clients we bring surpass than our Iza cost, we will be able to reduce future invoices, or we invoice her and she pays us the excess."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "End of year report. Standard price is 1000pln net. With our amount of invoices is 1.5k, but for us it will be equivalent of our monthly Iza invoice. Marcel said about 850pln gross approximately."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "When signing contract with ktw international foundation, to run the contract by her first."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Regarding Pawel, to sign an agreement with him, what he needs to handle, and how much our commission will be."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Regarding the car, it is lent to the company since March. We assigned 300pln. We aren''t paying this amount actually. But we do have to pay CIT. 324pln."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel and Bismark to go through the amount of invoices to make sure its correct amount cuz Iza says its correct. Sunday 8th Feb, to show Iza December invoice charge, vs how many invoices we actually had."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 10.02.2026
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '10.02.2026',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "10.02.2026"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Adi was informed about the ad, and it was suggested that he join calls to help close sales."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Adi prefers to join presentations as a backup rather than lead them."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "For presentation notices, Adi requires at least five hours'' notice, preferably between 11:00 a.m. and the evening."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Adi is open to starting the first class with group pricing and later moving to individual sessions."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan will create a link for Adi to update his availability."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The PRC case is covered: biometrics and stamping are completed, and the TRC is expected within a few months."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Regarding the fraud case, the Marcel has reported it to the police, border guards, and immigration authorities."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark will check with Marcel about the form needed to submit a business request and will update Damjan so the links can be updated."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan has started working on a new TRC ad with a callback request option and will post it to the group when requests come in."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 12.02.2026
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_meetings_folder_id,
        '12.02.2026',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "12.02.2026"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Warsaw fraud guys. Marcel will submit the info that there was fraudery, once he gets a response, to contact board guard so they aren''t written in the SYS and VYS system. Then once they pass exams, they go to their home countries to receive visas and come back to Poland to start TRC. Board guard submission and fraudery submission 3k per person including visa. Once they arrive, TRC prices separately paid. Tomorrow to call them to inform them about what is included and tell them the prices."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Driving license girl, waiting still in sosnowiec for updates."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marina case covered, in 2-3 months will receive decision."}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Pavlo, Janek''s friend did not reply to our email. Check with Janek, and potentially follow up."}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    RAISE NOTICE 'Added late 2025 and 2026 meeting documents!';
END $$;

-- Verify all meeting documents
SELECT 
    CASE WHEN folder_id IS NOT NULL THEN 'Meetings' ELSE 'No Folder' END as folder,
    COUNT(*) as count
FROM wiki_documents 
WHERE folder_id = (SELECT id FROM wiki_folders WHERE name = 'Meetings' LIMIT 1)
GROUP BY folder_id;
