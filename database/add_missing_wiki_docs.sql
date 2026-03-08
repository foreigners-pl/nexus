-- Add missing wiki documents to Miscellaneous folder
-- Missed Requests, TikTok Video Scripts, TikTok Video Scripts May, Colombian Team Names, Janek Interview, Language School Notes, Bismark's Consultation, Michal Interview

DO $$
DECLARE
    v_misc_folder_id UUID;
    v_owner_id UUID := '62ab2967-f186-4dc5-957c-8c927d58925b';
BEGIN
    -- Get the Miscellaneous folder ID
    SELECT id INTO v_misc_folder_id FROM wiki_folders WHERE name = 'Miscellaneous' LIMIT 1;
    
    IF v_misc_folder_id IS NULL THEN
        RAISE EXCEPTION 'Miscellaneous folder not found!';
    END IF;

    -- 1. Missed Requests (table document)
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_misc_folder_id,
        'Missed Requests',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Missed Requests"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Date"}, {"type": "text", "text": " | "}, {"type": "text", "marks": [{"type": "bold"}], "text": "Name"}, {"type": "text", "text": " | "}, {"type": "text", "marks": [{"type": "bold"}], "text": "Phone"}, {"type": "text", "text": " | "}, {"type": "text", "marks": [{"type": "bold"}], "text": "Email"}, {"type": "text", "text": " | "}, {"type": "text", "marks": [{"type": "bold"}], "text": "Service"}, {"type": "text", "text": " | "}, {"type": "text", "marks": [{"type": "bold"}], "text": "Location"}, {"type": "text", "text": " | "}, {"type": "text", "marks": [{"type": "bold"}], "text": "Country"}, {"type": "text", "text": " | "}, {"type": "text", "marks": [{"type": "bold"}], "text": "Message"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "2025-02-03 | Shakeel Mohammad | +49 176 84377449 | ayanktk006@gmail.com | Other | Deutschland | Help about license, cost, complete process"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "2025-01-28 | Sushil bhattarai | +356 7753 2455 | Bhattaraisushil200@gmail.com | Jobs | Malta | Need to check TRC"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "2025-01-26 | Ahsan sikandar | +48 576 519 474 | princeehsan93@gmail.com | Transport | Warsaw | Pakistani driving license conversion without exam"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "2025-01-20 | edward tito arroyo | +1 609-408-9243 | titoarroy@yahoo.com | Business | Warsaw/Lublin | HVAC business registry and tax info"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "2025-01-17 | Chukwuemeka Dallas | +234 708 555 5326 | dallaschukwuemeka@yahoo.com | Immigration | Poznan | Finding visa appointment date"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "2025-01-16 | Gloria Dallas | +234 806 499 5159 | gloriaolisa@gmail.com | Immigration | Poznan | Work permits processing and early appointments"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "2025-01-14 | Sarah Barrett | +27 82 698 6572 | sbsarajane25@gmail.com | Immigration | Wroclaw | Polish D-visa fees from South Africa"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "2025-01-10 | Mohammad Bilal | +48 733 780 793 | bilalmanikkandi@gmail.com | Other | Wroclaw | Nostrification of high school diploma"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "2025-01-09 | AMABEL NIEBRES | +965 9944 6751 | amabel.n@yahoo.com | Immigration | Wroclaw | Visa to visit fiance in Zagan Poland"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Intern Application"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "2025-01-23 | Tsitsi Tafadzwa Ndonde | tsitsi.ndonde@outlook.com | +48 575 915 175 | Customer Service Intern | Poznan"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Experience in customer care, administrative tasks and accounting."}]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 2. TikTok Video Scripts
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_misc_folder_id,
        'TikTok Video Scripts',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "TikTok Video Scripts"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Inspirational Links"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "• https://vm.tiktok.com/ZNddvTkCF/"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "• https://vm.tiktok.com/ZNddc2vkv/"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "• https://vm.tiktok.com/ZNddcNyd1/"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "VIDEO 1 – Can You Stay in Poland Without a Job?"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Camera direction:"}, {"type": "text", "text": " Start: Camera low, focused on your hand flipping a pen as you walk through the office. Mid: As you approach Marcel''s desk, camera pans up to frame Marcel from the side. End: Stays on Marcel from a side profile as he responds and keeps working."}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Script:"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You (off-screen): \"Hey Marcel – can someone stay in Poland legally without a job?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"Yeah. There are different types of permits that don''t require employment – studies, family, business…\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"Even if they''re just between jobs?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"If your permit is still valid – no issue. If it''s expiring soon, you should act fast.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"And if they''re totally lost?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"You can message us. We''ll check everything. Anytime. 24/7.\""}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "VIDEO 2 – Can You Get Married in Poland Without Speaking Polish?"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Camera direction:"}, {"type": "text", "text": " Start: Camera low, you walk in flipping through a mini Polish phrasebook. Mid: Camera pans up and frames Marcel from the side. End: Over-the-shoulder angle as he continues working."}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Script:"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"Marcel – can someone get married in Poland if they don''t speak any Polish at all? Like, not even dzień dobry.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"Yeah. They just need a sworn translator for the ceremony.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"So they don''t have to learn a speech?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"Nope. Translator takes care of it. They just need to say tak at the right moment.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"Romantic and low-effort. We love that.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"We handle the rest – translator, paperwork, all of it.\""}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "VIDEO 3 – What If a Foreigner Loses Their Job While TRC Is in Progress?"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Camera direction:"}, {"type": "text", "text": " Camera stays low and steady, filming from a seated angle. Marcel is in the background putting on his coat. As Marcel opens the door to leave, you ask the question from off-camera."}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Script:"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You (off-camera): \"Hey Marcel – what if a foreigner loses their job while their TRC is still being processed?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"If it''s a work-based permit, they should notify the office. Doesn''t always mean rejection, but timing matters.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"So it''s not an automatic no, but risky?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"Exactly. Better to talk to us early before it turns into a problem.\""}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Damjan Scripts"}]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Script 1"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Camera facing Bismark sitting at the head of the table, in a boss pose, camera static very slowly zooming out."}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Bismark: \"My friends always ask me ''Robert, how did you get your TRC so easy and fast.'' and the answer is simple - I have no idea, and my name isn''t Robert. All I did was reach out to Foreigners.pl, and they helped me with everything from PESEL all the way to TRC, and I didn''t have to do almost anything.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "As he is speaking, Marcel placing coffee in front of him, sugars, glass of water, and at the end giving him the TRC, and shaking hands."}]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Script 2"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"Why do we wait even up to 2 years just to get the biometrics appointment for the TRC in Poland?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"I''ll answer that with a game! Can you spot the difference? Most people can''t.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel holding 2 identical TRC Application documents, on one of them, one field is not filled out."}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"Even the slightest mistake can extend the waiting time by a whole year. At foreigners.pl we make sure everything is correct, from the first try. Because spotting the difference, makes a difference.\""}]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Script 3"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"Hello, I need help to submit my TRC application.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"Would you like some water?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"Oh, sure, thanks.\" (Drinks water) Marcel in the meanwhile takes form, pretends to fill out."}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"Your biometrics appointment is scheduled.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "You: \"No, last time I had to wait nearly 2 years for the biometrics. There has to be a mistake, I just came to you now.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Marcel: \"And its already scheduled, I''ll see you in May.\""}]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 3. TikTok Video Scripts May
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_misc_folder_id,
        'TikTok Video Scripts May',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "TikTok Video Scripts May"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "VIDEO 1 - You Shouldn''t Wait This Long for Your TRC"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "👤 Lawyer speaking directly to camera"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Hook (0–5 sec):"}, {"type": "text", "text": " \"If you''ve been waiting 8 or 9 months for your TRC… that''s way too long. Something''s wrong.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Informational Section (6–20 sec):"}, {"type": "text", "text": " \"Over 60% of delayed TRC cases in Poland are caused by incorrect or incomplete applications. And once the process gets stuck, it can take months to fix — or even lead to rejection.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Transformation Ending (21–30 sec):"}, {"type": "text", "text": " \"When you apply with a lawyer, everything is prepared the right way from the start — so you get your TRC faster, travel without worry, and finally reunite with the people who matter most.\""}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "VIDEO 2 - Choosing the Wrong Company Type in Poland"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "HOOK (0–5 sec):"}, {"type": "text", "text": " \"Thinking about opening a business in Poland? Be careful — choosing the wrong company type can cost you a lot later.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "INFORMATIONAL SECTION (6–20 sec):"}, {"type": "text", "text": " \"Each business structure comes with different rules. A limited liability company protects your personal assets but comes with higher costs. A sole proprietorship is cheaper and faster — but not everyone qualifies. Many foreigners register quickly and later realize they can''t hire employees, invoice clients correctly, or even apply for a residence card. Some end up paying way more tax than they should.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "TRANSFORMATION-FOCUSED ENDING (21–30 sec):"}, {"type": "text", "text": " \"At foreigners.pl, we help you choose and register the right company from the start — so you can grow your business with clarity, confidence, and peace of mind.\""}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "VIDEO 3 - Q&A: What''s Changing from June 1st?"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "CAMERAMAN (0–3 sec):"}, {"type": "text", "text": " \"Hey Marcel, quick question — tell me one thing that''s changing from June 1st in immigration law.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "LAWYER (3–12 sec):"}, {"type": "text", "text": " \"From June 1st, officers will check your income, housing, and ties to Poland much more strictly. If your documents aren''t clear, your case could get delayed or even rejected.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "CAMERAMAN (12–15 sec):"}, {"type": "text", "text": " \"Okay, so what do you suggest people do?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "LAWYER (15–25 sec):"}, {"type": "text", "text": " \"I suggest you act fast and make your stay legal before June 1st — the longer you wait, the harder it might get.\""}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "VIDEO 4 - Q&A: Can Foreigners Legally Start a Business in Poland?"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "CAMERAMAN (0–3 sec):"}, {"type": "text", "text": " \"Hey Marcel — quick question. Is it actually legal for foreigners to start a business in Poland?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "LAWYER (3–13 sec):"}, {"type": "text", "text": " \"Yes, it''s legal — but it depends on your residence status. If you have a residence card or long-term visa, you''re usually allowed. But your visa type matters, and choosing the wrong business setup can cause legal issues or even block your TRC.\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "CAMERAMAN (13–15 sec):"}, {"type": "text", "text": " \"Got it — so what''s your advice?\""}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "LAWYER (15–25 sec):"}, {"type": "text", "text": " \"We help you register legally and properly, so your business supports your goals — not creates problems later.\""}]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 4. Colombian Team Names (table)
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_misc_folder_id,
        'Colombian Team Names',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Colombian Team Names"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "List of the Colombian team:"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "First Name | Last Name | Status"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Diego Fernando | Becerra Avila | used in visa"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Juan José | Pérez Moreno | used in visa"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Daniel Jose | Avila Silva | used in visa"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Alvaro Enrique | Lara Noriega | used in visa"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Mayer Javier | Zambrano Pérez | -"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Darwin Alberto | Sánchez Gutiérrez | used in visa"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Javier | Castañeda Garcés | used in visa"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Michael Steve | Londoño Silva | -"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Brayan de Jesus | Leal Bautista | -"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Erick Leonardo | Armero Torres | -"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Heinner | Valenzuela | -"}]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 5. Janek Interview
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_misc_folder_id,
        'Janek Interview',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Janek Interview"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Background"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "3rd year law, University of Warsaw"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "First job: painting houses in Norway in his father''s company"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "2nd job: car rental company"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "No work experience with law, we will be the first one"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Has good experience of figuring things out"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Expectations"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Meeting with clients, getting to understand their issues"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Handling dynamic different cases he needs to figure out"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Hope to Gain"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Experience - understands how important experience is in law"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Likes meeting different people"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "University Requirements"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Uni asks them 3 months of practice, but at least 1 month court practice"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Availability This Semester"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Monday: starts classes from 3pm to 8pm"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tuesday: FREE"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Wednesday: starts 9:30am to 4pm"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Thursday: FULLY FREE"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Friday: FULLY FREE"}]}]}
                ]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Willing to travel to all around Poland"}]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 6. Language School Client Notes
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_misc_folder_id,
        'Language School Client Notes',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Language School Client Notes"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Amelia 4pm:"}, {"type": "text", "text": " A1, prefers on site. Gdansk. Wants a group with random people. Agreed to let her know when group is gathered."}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "6pm:"}, {"type": "text", "text": " A0, schedule is complex, always different, but doesn''t wanna pay solo price asked for group. Explained why it will be hard due to his schedule. Mentioned that I will try to discount the solo price, and he will try to get a friend for a 2 group class. To send both offers A0 for solo with discounted price, and A0 for 2 people."}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "29th - 12pm:"}, {"type": "text", "text": " No show, messaged, proposed to meet another time, waiting for reply"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "30th - 13pm:"}, {"type": "text", "text": " Wants small group or large group. Ideal start date next week. A0. Very religious, half an hour convo about it. Proposed group in few weeks."}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "1st - 13pm:"}, {"type": "text", "text": " Joined late, accepted once I informed them that I''m waiting in the meeting. A0, wants group, ready to start asap. Has PESEL, TRC is in progress, year for biometrics. Tuesday next week appt with Marcel 12pm-1pm."}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "2nd - 7pm:"}, {"type": "text", "text": " From chat said wants A2. Asap, wants in group, even if its just 1 other person. Citizenship changes mentioned. Hopes it won''t be implemented soon."}]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 7. Bismark's Client Consultation
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_misc_folder_id,
        'Bismark''s Client Consultation',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Bismark''s Client Consultation"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Services Inquired"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Virtual assistant services for back end office work"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "App development services with the use of avatar and AI utilization"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Driver license conversion USA to Poland"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Business registration"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Platform Details"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Launching a platform within next 1-1.5 months"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "On demand service company - plumber has 3pm appointment in a diff city and he is enroute, customer has to cancel, tech has open time slot, at same time another client needs a plumber, auto matching"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Job categories are unlimited"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Wants to have the company registered in Poland"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Wants to be hosted and ran out of Poland"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Client Background"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Great grandparents from Poland, has PESEL and Polish passport"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "LLC in the states"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Immediate Needs"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Wants a bank account in Poland as well"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Business Registration + Bank Account (quote for this)"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Future Plans (2026)"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Driver''s license if he wants an office in the future"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Business Types"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Fixly app"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Nutrition"}]}]}
                ]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    -- 8. Michal Interview
    INSERT INTO wiki_documents (id, folder_id, title, content, document_type, is_shared, owner_id)
    VALUES (
        gen_random_uuid(),
        v_misc_folder_id,
        'Michal Interview',
        '{
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Michal Interview"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "About Him"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Teaches all ages from 10 to 75 (youngest to oldest so far)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Does courses preparing students for state exams"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Self employed, can issue invoices to more companies"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "End of each month, daje slowo (time to learn polish), he issues invoices for the hours he worked that month"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "1. Availability & Flexibility"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Answer:"}, {"type": "text", "text": " Ending cooperation with current school, has semester groups in evenings that will end soon, and will have more available calendar."}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "2. Pricing Expectations"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Answer:"}, {"type": "text", "text": " 100zł from a school"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "3. Teaching Style & Specializations"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Answer:"}, {"type": "text", "text": " Doesn''t like when someone lied for their level, so they are on the correct group. If there''s other groups he suggests to move them to the lower level, if not he tries to go lower to their level to help them catch up."}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "4. Tools, Digital Skills & Content Creation"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Answer:"}, {"type": "text", "text": " Uses Google Meets, makes his own presentations (for exams, for pronunciation). Polsku po Polsce platform. Finds games as well."}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "5. Attitude toward Growing, Early-Stage Project"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Answer:"}, {"type": "text", "text": " Is excited to be in the early stages of a new project"}]}
            ]
        }'::jsonb,
        'rich-text',
        true,
        v_owner_id
    );

    RAISE NOTICE 'Added 8 missing documents to Miscellaneous folder!';
END $$;

-- Verify the new documents
SELECT title, document_type, created_at 
FROM wiki_documents 
WHERE folder_id = (SELECT id FROM wiki_folders WHERE name = 'Miscellaneous')
ORDER BY created_at DESC;
