-- Wiki Import Migration
-- This imports the company wiki data from the old CRM
-- 
-- IMPORTANT: Before running, replace 'YOUR_USER_ID_HERE' with an actual user UUID
-- You can get a user ID by running: SELECT id FROM auth.users LIMIT 1;

-- Set the owner ID (replace with actual user ID)
DO $$
DECLARE
    v_owner_id UUID;
    v_folder_id UUID;
    v_position INT;
BEGIN
    -- Get the first user as owner (or replace with specific user ID)
    SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
    
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'No users found. Please create a user first.';
    END IF;

    -- ============================================
    -- FOLDER 1: Company Information
    -- ============================================
    INSERT INTO wiki_folders (name, owner_id, is_shared, position)
    VALUES ('Company Information', v_owner_id, false, 0)
    RETURNING id INTO v_folder_id;

    -- Goals
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Goals', '{
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Mid 2025 Goals"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Achieve 3 lawyers per city by the end of June."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Reach ?k PLN in revenue by June"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "TikTok: 25k followers"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Instagram: 2.5k followers"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Onboard 3 companies for job listings."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Organize at least one in-person event."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Convert at least 35 clients."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Aim to come as close as possible to applying for a grant."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Target a 50% profit margin."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Q1 2025 Goals"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "50k PLN revenue"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tiktok: 15k followers"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Instagram: 1.0k followers"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Onboard 1 company for job listing"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Convert 14 clients"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "January Goals / mid month check in"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "10k Revenue - / 0.00"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Tiktok: 8.5k / 6.972 followers"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Instagram: 200 / 82 followers"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Get a response from at least 3 companies - 0 response"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hire 1 employee/Intern - 0"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Rebranding - in progress"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "10 articles for January - 2"}]}]}
            ]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 0);

    -- Brand colors
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Brand colors', '{
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Dark #242323"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Bright #FCF9FF"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Red #AB1604"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 1);

    -- Emails
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Emails', '{
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Sarvan Najafli: sarvan.najafli@yahoo.com"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Marcel Wieczorkowski: marcelwieczorkowski@gmail.com"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Bismark Mensah: bismark_mensah@outlook.com"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Damjan Zdravkovski: damjan.zdravkovski3@gmail.com"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 2);

    -- Login Info
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Login Info', '{
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Business Email"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Legacy Password: Foreigners@pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: tienga-nnaasab-ykmenso"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Instagram"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: Foreigners@pl"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Tiktok"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: Samqe1-kikgim-vidvev"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Facebook"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: Foreigners@pl"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "X"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: tekted-kyjhen-qyhRu8"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Stripe"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: vumwUg-fakbat-vebjo5"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Backup code: jzxh-achd-yiqz-eiea-kyyk"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Aftermarket.pl/Domain"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: sagmev-dinpif-nyDsa2"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Pracuj.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: Foreigners.pl2025"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Fakturownia.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: Foreigners.pl2025"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "App: foreigners1.fakturownia.pl"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Alternative Gmail"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: foreigners.pl@gmail.com"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: Foreigners@pl2025"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Sling"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Logged in with Google"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Nokia Phone"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "PIN: 1907"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Nokia Smartphone"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "PIN: 1702"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Call recording app PIN: 1907"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Intern Accounts"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Feruzakhon Yuldashova - fy1702.fpl@gmail.com / muxKoq-7topko-nekhoc"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Nikola Lewicka - nl1702.fpl@gmail.com / Fimha1-curmag-xomnah"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Ewa - ek2402.fpl@gmail.com / ruggig-3poWdy-sezkaf"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Aleksandra - aw0303.fpl@gmail.com / wowik-6uyWdr-se9kat"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Oskar - oc1905.fpl@gmail.com / ruxqep-7mtafw-kj19vz"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Ali - at0307.fpl@gmail.com / geawd-6FmasY-jO2lbq"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Janek - js0412.fpl@gmail.com / apwng-3FbGa-gK0ar"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "ChatGPT"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: FPLassistant2025"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "druk-24.com.pl (print shop)"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Email: connect@foreigners.pl"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Password: bixWaq-widru8-kenjyh"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 3);

    -- Business Details/NIP/Address
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Business Details/NIP/Address', '{
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "FOREIGNERS.PL SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Foreigners.pl Sp. z o.o."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "UL. 3 MAJA 31 / 4, 40-097 KATOWICE"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Aleje Jerozolimskie 109, 02-001 Warsaw"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "NIP: 6343044313"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "KRS: 0001124675"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "REGON: 529550774"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 4);

    -- Job Offers
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Job Offers', '{
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Potential Companies"}]},
            {"type": "orderedList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Accenture Poland - Known to hire international candidates, including those outside Poland, for roles in IT and consulting. They frequently sponsor work permits."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Teleperformance Poland - Often hires for customer support roles and is open to sponsoring work permits for the right candidates."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Capgemini Poland - This multinational IT services company recruits international talent and provides work permits, especially for specialized roles in IT, consulting, and finance."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Amazon Poland - Actively hires for logistics, warehouse, and corporate roles. For higher-level positions, they offer relocation support and sponsorship."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "GlobalLogic Poland - Specializes in IT and software development. Known to hire globally and assist with relocation and work permits."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "GSK (GlaxoSmithKline) Poland - Frequently recruits international talent, especially in pharmaceuticals and R&D, with work permits offered for suitable candidates."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Google Poland (Warsaw Office) - Actively seeks international candidates for tech roles, providing relocation support and visa sponsorship."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Email Template (English)"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Subject: Relocation Services for International Employees"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Dear [Recipient''s Name/HR Department],"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "My name is [Your Name], and I represent Foreigners.pl, a specialized company dedicated to assisting businesses in Poland with the comprehensive relocation process for international employees. Our services include: Work permits and visa applications, Housing arrangements, Administrative and integration support."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "We are reaching out to inquire if your company is currently hiring international candidates and providing work permits. If so, we would like to propose outsourcing the relocation and administrative tasks associated with this process to us, at no cost to your company."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Our aim is to streamline the hiring process for international talent, facilitating your expansion into the global workforce. We believe our services can significantly simplify the integration of international employees, making the transition seamless and efficient."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "We would greatly appreciate the opportunity to discuss this proposal in more detail and explore how we can best support your international hiring needs. Please let us know a convenient time for a meeting."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Thank you for your consideration."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Best Regards"}]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Email Template (Polish)"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Szanowni Państwo [Recipient''s Name/HR Department],"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Nazywam się [Your Name] i reprezentuję firmę Foreigners.pl, specjalizującą się w kompleksowym wsparciu przedsiębiorstw w Polsce w procesie relokacji pracowników międzynarodowych. Nasze usługi obejmują: Uzyskiwanie zezwoleń na pracę oraz wizy, Organizację zakwaterowania, Wsparcie administracyjne i integracyjne."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Zwracamy się z pytaniem, czy Państwa firma aktualnie zatrudnia pracowników międzynarodowych i zapewnia im zezwolenia na pracę. Jeśli tak, chcielibyśmy zaproponować Państwu outsourcing zadań związanych z relokacją i administracją tego procesu, bez żadnych kosztów dla Państwa firmy."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Naszym celem jest uproszczenie procesu zatrudniania międzynarodowych talentów oraz wsparcie Państwa w rozwoju na rynku globalnym. Wierzymy, że nasze usługi mogą znacząco ułatwić integrację pracowników międzynarodowych, zapewniając płynne i efektywne przejście."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Bylibyśmy wdzięczni za możliwość omówienia tej propozycji bardziej szczegółowo oraz za wskazanie dogodnego terminu na spotkanie."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Dziękujemy za rozważenie naszej oferty."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Z poważaniem,"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 5);

    -- Monthly Briefing Links
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Monthly Briefing Links', '{
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Law: https://www.canva.com/design/DAGorFb42Qc/Mp8DrvLZl1uKF0MP-Tmk8g/edit"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "CS & Finance: https://www.canva.com/design/DAGorLj1684/-_CP-jNLLKb5NuinXwGtuw/edit"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Marketing: https://www.canva.com/design/DAGorAKsMZU/ynSF6zYdZFl5AziioOE1Og/edit"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "IT: https://www.canva.com/design/DAGorBQSZo8/hz9kEaQtgSKe_Jo6wmDeHQ/edit"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 6);

    -- ============================================
    -- FOLDER 2: Company Standards
    -- ============================================
    INSERT INTO wiki_folders (name, owner_id, is_shared, position)
    VALUES ('Company Standards', v_owner_id, false, 1)
    RETURNING id INTO v_folder_id;

    -- Customer Success (empty)
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Customer Success', '{
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Customer Success standards - To be documented"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 0);

    -- Marketing
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Marketing', '{
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Creative & Content Standards for Foreigners.pl"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "1. Brand Voice & Tone"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Clear, confident, helpful. Never vague or too formal."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Uses bold statements as headlines to create emotional hooks or curiosity."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Language must be simple and direct. No bureaucratic or complex terms."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Speak to the pain point, then offer a solution (usually ending with foreigners.pl)."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Each carousel ends with a strong CTA: We handle it for you → foreigners.pl."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "2. Design Standards"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Style: Professional, modern, minimalistic"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Color Palette: Pure Black #000000, Pure White #FFFFFF, Red #AB1604"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Use lots of white space, bold typography, and clean visual hierarchy."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Icons and emojis (only if used) should be minimal and supportive."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "3. Carousel Slide Structure"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "5/6 slides max per carousel (ideal for IG)."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Each slide should have: A main bold statement (centered or top-aligned), A short supporting description (1/2 lines max)."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Final slide must always promote: foreigners.pl, We help with [service], CTA like: DM us / Book a free consultation"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "4. Service-Specific Carousel Themes"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Polish Visa - Hook: They''ll reject your visa. Then keep your fee."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Nostrification - Hook: Nostrification: The Step No One Warned You About"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Car Registration - Hook: You have 30 days. Or you could pay for it later."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "PESEL - Hook: PESEL: The Key to Unlocking Life in Poland"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Business Registration - Hook: Don''t register your company… until you read this."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "5. Mascot / Visual Element"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Simple, modern, helpful-looking (like a guide or assistant)."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Professional and neutral – no cartoonish styling."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Used when it adds to clarity or brand identity (e.g. final slides, intros)."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "6. Captions & Hashtags"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Captions should open with an emotional pain point or hook."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Include 3-5 bullet-style pain points or benefits."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Always end with a CTA: DM us / Book a free consultation / Let foreigners.pl help."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Use tailored, niche-relevant hashtags (10-20 per post). Avoid spammy ones."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "7. Post Flow"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Pick a pain point or confusing topic relevant to foreigners in Poland."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Start with a bold hook statement."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Support it with short slides that show the problem clearly."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "End with the solution: foreigners.pl."}]}]}
            ]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 1);

    -- IT
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('IT', '{
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Website Design Standards"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Style: Professional, modern, minimalistic"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Color Palette: Pure Black #000000, Pure White #FFFFFF, Red #AB1604"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Use lots of white space, bold typography, and clean visual hierarchy."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Icons and emojis (only if used) should be minimal and supportive."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Blog/News Standards"}]},
            {"type": "orderedList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Blog Ideas - Focus on targeting common processes that foreigners experience in Poland. From experiences of initiating a move to Poland, to the legal system, cultural integration, language, travelling, driving, business etc."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "News Ideas - Do extensive research on any changes in the Polish system that could affect foreigners in any way. The more impactful the change, the higher ranking you should give for that suggestion."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Writing - Once an idea has been chosen: come up with a focus keyword (3-5 words), write the post title with focus keyword, add focus keyword to at least one H1, H2 or H3, add focus keyword at least once to body text, write meta description with focus keyword (155-165 characters)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Final product order: Focus Keyword, Entire Article, Meta Description"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "CSR Guidelines"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "If screenshots are shared, those are from the client. Review the information and respond based on the question."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Use the client''s name every time when asked to write a reply."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Answer only from attached files for procedures/questions. Ask permission before going online if answer not found."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Online search only on official/governmental websites. No forums or personal blogs."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ask questions to verify eligibility and possibility before giving legal advice."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Communication is via WhatsApp - keep responses short, concise, professional but friendly. No emojis."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Do not use bold letters in client communication messages."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "We only deal with clients pre-payment, so don''t ask for documents or say you''ll submit applications until they pay."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sales-Oriented Instructions"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Always craft responses to gently lead toward a successful sale."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Emphasize benefits: saves time, reduces stress, increases chances of success."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Address potential objections proactively (difficulty, delays, confusing rules)."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Use urgency when relevant - limited appointment slots, time-sensitive procedures."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Always include a clear and simple next step."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Tone & Language Instructions"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Avoid overly formal or corporate-sounding language - keep it clear, simple, and natural."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sound like someone who genuinely wants to help - calm, confident, and empathetic."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "If the client seems confused, stressed, or overwhelmed, acknowledge it gently."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Reassure with phrases like ''we''ll guide you through it'', ''you won''t need to worry about that''."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Keep sentences short and easy to follow."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Goal: Make the client feel like they''re in good hands."}]}]}
            ]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 2);

    -- Legal
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Legal', '{
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Legal Process Department Standards for Chat"}]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Compliance with Applicable Law"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "All actions must comply with the current legal framework (local, national, and EU)."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The system should reflect legislative changes and include a mechanism for regular legal updates."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Confidentiality and Data Protection"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Personal data must be processed in accordance with GDPR."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "All user-submitted data must be encrypted and protected from unauthorized access."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Internal NDA procedures for employees and users with data access must be enforced."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Transparency of Actions"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Every action performed by the system should be auditable (operation logging)."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "End users must clearly understand the source of legal information and its legal basis."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Accuracy and Precision of Information"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "All legal advice and generated documents must be based on verified sources and up-to-date legal provisions."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The system should reference specific legal sources (articles, acts, regulations)."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Impartiality and Emotional Neutrality"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Legal responses must be neutral, free from personal opinions."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The chat or system must not suggest any solutions that contradict the law."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Responsiveness and Timeliness"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Each case/request should be processed within a defined timeframe (e.g., initial reply within 24 hours)."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The system should include reminders for approaching deadlines (e.g., appeals, document submissions)."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Document Standardization"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "All documents generated by the system must follow a standardized format, legal language, and include all required formal elements."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Version control and archiving must be available."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Professional Ethics"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "No legal advice should be provided in cases involving law violations or unethical behavior."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The system must not instruct users on how to circumvent the law."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Language Accessibility"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The system should support at least two languages (e.g., Polish and English), with the option to expand."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "All translations must use proper legal terminology."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Modularity and Scalability"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The system should allow easy expansion with new legal procedures (e.g., immigration, real estate, company law)."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "It should support adaptation to different jurisdictions."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Validation and Testing of Processes"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Every legal procedure must be reviewed and tested by a legal expert before implementation."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Regular audits and updates are required."}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Accountability"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Each legal response or action must be marked as either automated or verified by a legal professional."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "End users must be informed about the nature of the provided information (informational vs. legal advice)."}]}]}
            ]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 3);

    -- ============================================
    -- FOLDER 3: Template Messages
    -- ============================================
    INSERT INTO wiki_folders (name, owner_id, is_shared, position)
    VALUES ('Template Messages', v_owner_id, false, 2)
    RETURNING id INTO v_folder_id;

    -- Initial Info
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Initial Info', '{
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Dear [Customer''s Name],"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Thank you for reaching out to us! To assist you better, could you please provide the following details?"}]},
            {"type": "orderedList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Full Name:"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Contact Email:"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Country Code (e.g., +48 for Poland):"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Contact Number:"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Country of Origin:"}]}]}
            ]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Once we have this information, we''ll be able to address your inquiry more effectively. Looking forward to hearing from you!"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Best regards,"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Foreigners.pl Team"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 0);

    -- Promotions/Price Negotiation
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Promotions/Price Negotiation', '{
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "1. Social Media Engagement Discounts"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "We''d love your feedback! Share your experience by leaving a review on our Facebook page, and we''ll be happy to offer a 10% discount as a thank you!"}]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "2. Limited-Time Offer for First-Time Customers"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "We''re excited to welcome new clients! As a first-time customer, you''re eligible for an exclusive 10% discount on your first service with us if booked within 3 days."}]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "3. Sharing on Social Media"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Follow us on social media platforms such as Instagram, TikTok and Facebook and receive a 10% discount."}]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "4. Customer Loyalty Reward"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "We value loyal customers! After completing three services with us, you''ll receive a 20% discount on your next service as our thank you. (4th one will be discounted)"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 1);

    -- Consultation email (empty)
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Consultation email', '{
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Consultation email template - To be documented"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 2);

    -- ============================================
    -- FOLDER 4: Business Model
    -- ============================================
    INSERT INTO wiki_folders (name, owner_id, is_shared, position)
    VALUES ('Business Model', v_owner_id, false, 3)
    RETURNING id INTO v_folder_id;

    -- Service Prices
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Service Prices', '{
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Prices could need to be altered based on specific circumstances of each request. The prices below are the base prices for each service, which might need to be later negotiated."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "If any service requires our in-person presence, explain to the client that it would be an additional charge per visit, dependent on their city/location. Request for a review to obtain the price for the in-person visit."}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Clients are paying the Gross Price (Gross Price = Net Price + VAT)"}]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Immigration Services"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "TRC Basic: 249 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "TRC Premium: 2599 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "TRC Plus: 1999 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Visa Arrangement: 1699 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "PESEL: 599 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "TRC Expedite: 1599 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Work Permit: 1349 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Permanent Residence Card (PRC): Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "EU Blue Card: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Proof of Accommodation (1 year): 1599 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Proof of Accommodation (2 years): 2599 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "TRC Appeal: 1599 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Visa Appeal: 1699 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Invitation Letter: 499 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Nostrification: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Document Legalization: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "General Consultation: 249 PLN (23% VAT)"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Driving Services"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Driving License Conversion (Non-EU): 549 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Driving License Conversion (EU): 399 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "New Driving License: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Car Registration: 849 PLN (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Parking Permit: 749 PLN (23% VAT)"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Language Services"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sworn Translation: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Remote Assistance: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Court Interpretation: Individual (23% VAT)"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Business Services"}]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Register a Business: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Simplified Accounting: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Full Accounting: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Payroll and Human Resources: Individual (23% VAT)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Additional Services: Individual (23% VAT)"}]}]}
            ]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 0);

    -- ============================================
    -- FOLDER 5: Contacts
    -- ============================================
    INSERT INTO wiki_folders (name, owner_id, is_shared, position)
    VALUES ('Contacts', v_owner_id, false, 4)
    RETURNING id INTO v_folder_id;

    -- Contacts Table
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Contacts Directory', '{
        "headers": ["City", "Sworn Translator", "Driving Instructor", "Medical Clinic", "Immigration Lawyer"],
        "rows": [
            ["Warsaw", "Anna Kowalska (anna.kowalska@translations.pl)", "Michał Lewandowski (+48 654 321 987)", "Medicover Warsaw (+48 111 222 333)", "Paweł Olszewski (+48 987 654 321)"],
            ["Warsaw", "Tomasz Malinowski (tomasz.malinowski@sworn-trans.pl)", "Joanna Król (+48 555 666 777)", "LuxMed Warsaw (+48 222 333 444)", "Monika Lewandowska (+48 876 543 210)"],
            ["Warsaw", "Alicja Grabowska (alicja.grabowska@translateme.pl)", "Wojciech Nowak (+48 666 777 888)", "Enel-Med Warsaw (+48 333 444 555)", "Adam Zawada (+48 765 432 109)"],
            ["Kraków", "Jan Nowak (jan.nowak@krktrans.pl, +48 234 567 890)", "Katarzyna Maj (+48 765 432 198)", "LuxMed Kraków (+48 222 333 444)", "Zofia Piotrowska (+48 876 543 210)"],
            ["Kraków", "Maria Piasecka (maria.piasecka@trans-krakow.pl, +48 345 678 901)", "Rafał Śliwa (+48 876 543 209)", "Medicover Kraków (+48 333 444 555)", "Mateusz Kwiatkowski (+48 765 432 109)"],
            ["Kraków", "Krzysztof Zawadzki (krzysztof.zawadzki@sworn.krakow.pl, +48 456 789 012)", "Paulina Kowal (+48 987 654 320)", "Enel-Med Kraków (+48 444 555 666)", "Karolina Cieślak (+48 654 321 098)"],
            ["Wrocław", "Ewa Zielińska (ewa.zielinska@wroclawtrans.pl, +48 567 890 123)", "Andrzej Pawlak (+48 876 543 209)", "Medix Wrocław (+48 333 444 555)", "Karol Kamiński (+48 654 321 098)"],
            ["Wrocław", "Robert Bąk (robert.bak@wroclaw-translators.pl, +48 678 901 234)", "Justyna Górska (+48 765 432 198)", "LuxMed Wrocław (+48 444 555 666)", "Janina Mazur (+48 543 210 987)"],
            ["Wrocław", "Magdalena Jaworska (magdalena.jaworska@wrotrans.pl, +48 789 012 345)", "Maciej Woźniak (+48 654 321 987)", "Enel-Med Wrocław (+48 555 666 777)", "Tomasz Woźniak (+48 432 109 876)"],
            ["Gdańsk", "Piotr Wiśniewski (piotr.wisniewski@gdansk-translations.pl, +48 098 765 432)", "Krzysztof Nowicki (+48 987 654 320)", "Baltic Clinic Gdańsk (+48 444 555 666)", "Agnieszka Domańska (+48 654 321 098)"],
            ["Gdańsk", "Grażyna Maj (grazyna.maj@gdansk-trans.pl, +48 876 543 210)", "Aneta Marciniak (+48 876 543 210)", "LuxMed Gdańsk (+48 555 666 777)", "Aleksandra Jabłońska (+48 543 210 876)"],
            ["Gdańsk", "Paweł Sadowski (pawel.sadowski@sworn-gdansk.pl, +48 765 432 109)", "Sebastian Borowski (+48 765 432 109)", "Enel-Med Gdańsk (+48 666 777 888)", "Piotr Walczak (+48 432 109 765)"],
            ["Poznań", "Marta Szymańska (marta.szymanska@poztrans.pl, +48 654 321 987)", "Beata Kaczmarek (+48 098 765 432)", "ProClinic Poznań (+48 555 666 777)", "Rafał Jabłoński (+48 543 210 987)"],
            ["Poznań", "Łukasz Kozłowski (lukasz.kozlowski@poz-sworntrans.pl, +48 543 210 876)", "Tomasz Jabłoński (+48 987 654 321)", "LuxMed Poznań (+48 666 777 888)", "Anna Wysocka (+48 432 109 876)"],
            ["Poznań", "Dorota Michalska (dorota.michalska@translations-poznan.pl, +48 432 109 765)", "Ewelina Witkowska (+48 876 543 210)", "Medicover Poznań (+48 777 888 999)", "Jacek Śliwa (+48 321 098 765)"]
        ]
    }'::jsonb, 'table', v_owner_id, v_folder_id, false, 0);

    -- ============================================
    -- FOLDER 6: Miscellaneous
    -- ============================================
    INSERT INTO wiki_folders (name, owner_id, is_shared, position)
    VALUES ('Miscellaneous', v_owner_id, false, 5)
    RETURNING id INTO v_folder_id;

    -- Invoice Links
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Invoice Links', '{
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Stripe Invoice Link"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "https://dashboard.stripe.com/account/documents"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 0);

    -- Legal Processes
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('Legal Processes', '{
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Visa Arrangement Procedure"}]},
            {"type": "orderedList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Review of the Case/Consultation - Understand the applicant''s travel purpose, duration, and visa eligibility."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Collection/Verification of Documents - Visa Application Form, Photograph, Passport, Proof of Health Insurance, Proof of Accommodation, Proof of Financial Means, Proof of Purpose"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Appointment Scheduling Assistance on the Embassy Website (Remote)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Remote Communication Assistance During Appointment"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Monitoring Application Status"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Work Permit Procedure"}]},
            {"type": "orderedList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Review of the Case/Consultation - Confirm eligibility for Type A work permit"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Power of Attorney Letter"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Document Collection - Copy of Passport, Proof of Qualifications, Health Insurance, Employment Contract"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Document Review"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Labor Market Test Submission Support"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Application Preparation"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Appointment Scheduling Assistance at Voivodeship Office"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Application Submission"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Monitoring Application Status"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Decision Collection Support"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "TRC (Temporary Residence Card) Procedure"}]},
            {"type": "orderedList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Review of the Case/Consultation"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Power of Attorney Letter"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Collection/Verification of Documents - Passport, Health Insurance, Proof of Income, Proof of Accommodation, Purpose-Specific Documents"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "TRC Application Submission"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Assistance with Scheduling Biometrics Appointment"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Remote Assistance During Biometrics Appointment"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Handling Communication with the Office"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Monitoring Application Status"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Remote Assistance for Collecting the Decision Document"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Remote Assistance for Collecting the TRC"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "PRC (Permanent Residence Card) Procedure"}]},
            {"type": "orderedList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Review of the Case/Consultation - Confirm 5 years continuous legal stay"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Power of Attorney Letter"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Document Collection - Passport, Proof of Continuous Stay, Proof of Income, Proof of Accommodation, Health Insurance, Language Proficiency Certificate (B1+)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Document Review"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Application Submission at Voivodeship Office"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Biometrics Assistance"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Monitoring Application Status"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Decision Appointment Support"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Card Collection Support"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "EU Blue Card Procedure"}]},
            {"type": "orderedList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Review of the Case/Consultation - Verify qualifications and salary requirements (150% of average gross annual salary)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Power of Attorney Letter"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Document Collection - Passport, Employment Contract (min 1 year), Proof of Higher Qualifications, Health Insurance, Proof of Accommodation, Proof of Salary"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Document Review"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Application Preparation"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Appointment Scheduling Assistance"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Application Submission"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Monitoring Application Status"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Card Collection Support"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "PESEL Procedure"}]},
            {"type": "orderedList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Review of the Case/Consultation - Confirm eligibility based on residency status"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Power of Attorney"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Document Collection - Proof of Identity, Proof of Legal Stay, Proof of Address, Application Form"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Application Submission at local municipal office (Urząd Gminy/Miasta)"}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Communication with Authorities"}]}]}
            ]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Other Procedures"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Additional procedures available: Proof of Accommodation, Invitation Letter, Nostrification, Document Legalization, General Consultation, Mortgage Consultations, Cleaning Service, Car Registration, Court Interpretation, TRC Expedite"}]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 1);

    -- ============================================
    -- FOLDER 7: Meetings (sample - just a few)
    -- ============================================
    INSERT INTO wiki_folders (name, owner_id, is_shared, position)
    VALUES ('Meetings', v_owner_id, false, 6)
    RETURNING id INTO v_folder_id;

    -- 12.02.2026 Meeting
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('12.02.2026', '{
        "type": "doc",
        "content": [
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Warsaw fraud guys. Marcel will submit the info that there was fraudery, once he gets a response, to contact board guard so they aren''t written in the SYS and VYS system. Then once they pass exams, they go to their home countries to receive visas and come back to Poland to start TRC. Board guard submission and fraudery submission 3k per person including visa. Once they arrive, TRC prices separately paid. Tomorrow to call them to inform them about what is included and tell them the prices."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Driving license girl, waiting still in sosnowiec for updates."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marina case covered, in 2-3 months will receive decision."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Pavlo, Janek''s friend did not reply to our email. Check with Janek, and potentially follow up."}]}]}
            ]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 0);

    -- 10/02/2026 Meeting
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('10.02.2026', '{
        "type": "doc",
        "content": [
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Adi was informed about the ad, and it was suggested that he join calls to help close sales."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Adi prefers to join presentations as a backup rather than lead them."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "For presentation notices, Adi requires at least five hours'' notice, preferably between 11:00 a.m. and the evening."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Adi is open to starting the first class with group pricing and later moving to individual sessions."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Damjan will create a link for Adi to update his availability."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The PRC case is covered: biometrics and stamping are completed, and the TRC is expected within a few months."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Regarding the fraud case, Marcel has reported it to the police, border guards, and immigration authorities."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bismark will check with Marcel about the form needed to submit a business request and will update Damjan so the links can be updated."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Sarvan has started working on a new TRC ad with a callback request option and will post it to the group when requests come in."}]}]}
            ]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 1);

    -- 03.02.2026 Meeting
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('03.02.2026', '{
        "type": "doc",
        "content": [
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Iza finally answered. Agreed on website partnership. She will send us logo materials and we need to send it to her."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Our cost, 540pln net, from now it will be 390pln after we provided her monthly client."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "PIT service will be provided to us with discounted price. Price to be on email. Our cut on top will go to her, she will deduct our invoice by this amount."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "End of year report. Standard price is 1000pln net. With our amount of invoices is 1.5k, but for us it will be equivalent of our monthly Iza invoice. Marcel said about 850pln gross approximately."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "When signing contract with ktw international foundation, to run the contract by her first."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Regarding Pawel, to sign an agreement with him, what he needs to handle, and how much our commission will be."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Regarding the car, it is lent to the company since March. We assigned 300pln. We aren''t paying this amount actually. But we do have to pay CIT. 324pln."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marcel and Bismark to go through the amount of invoices to make sure its correct amount cuz Iza says its correct. Sunday 8th Feb, to show Iza December invoice charge, vs how many invoices we actually had."}]}]}
            ]}
        ]
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 2);

    -- 08.07.2025 Meeting
    INSERT INTO wiki_documents (title, content, document_type, owner_id, folder_id, is_shared, position)
    VALUES ('08.07.2025', '{
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Meeting minutes"}]},
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
    }'::jsonb, 'rich-text', v_owner_id, v_folder_id, false, 3);

    RAISE NOTICE 'Wiki import completed successfully!';
    RAISE NOTICE 'Created folders: Company Information, Company Standards, Template Messages, Business Model, Contacts, Miscellaneous, Meetings';

END $$;
