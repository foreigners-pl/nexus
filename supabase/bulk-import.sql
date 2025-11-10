-- ===================================================
-- BULK IMPORT SCRIPT - Last 10 Client Records
-- ===================================================
-- Instructions:
-- 1. Open your Supabase SQL Editor
-- 2. Paste this entire script
-- 3. Run it
-- 
-- This will create:
-- - Clients with first_name and last_name split at first space
-- - Phone numbers marked as WhatsApp
-- - Cases with "New" status
-- - Default installments
-- - Comments with "Category - Contact Method"
-- ===================================================

DO $$
DECLARE
  v_status_id uuid;
  v_user_id uuid;
  v_client_id uuid;
  v_case_id uuid;
BEGIN
  -- Get "New" status
  SELECT id INTO v_status_id FROM status WHERE name = 'New' LIMIT 1;
  IF v_status_id IS NULL THEN
    RAISE EXCEPTION 'Status "New" not found. Please create it first.';
  END IF;
  
  -- Get current user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please create a user first.';
  END IF;

  -- LAST 10 CLIENT RECORDS
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'Samantha', 'Ndiweni'); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+48763139214', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Home Form - WhatsApp Message');
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'Mohayideen', 'Mahamudu'); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+233544455636', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Home Form - WhatsApp Message');
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'Hadji', 'bacar'); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+255625407634', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Immigration Form - WhatsApp Call');
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'abhay', ''); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+919209609798', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Immigration Form - WhatsApp Message');
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'Darly', 'Maciel'); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+5547996927535', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Immigration Form - WhatsApp Call');
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'Rajendra', 'karki'); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+48739490325', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Immigration Form - WhatsApp Message');
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'Hassan', ''); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+48516795560', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Home Form - WhatsApp Call');
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'Baljinder', 'Singh Hardev Singh Bhoday'); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+48739409898', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Immigration Form - WhatsApp Message');
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'Ghulam', 'Abbas'); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+48794485558', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Immigration Form - WhatsApp Call');
  
  v_client_id := gen_random_uuid(); INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, 'Vusumuzi', 'James Moyo'); INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, '+27760931283', true); INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id; INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false); INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, 'Immigration Form - WhatsApp Message');
  
  RAISE NOTICE '✅ Bulk import completed successfully! Check your clients and cases tables.';
END $$;
