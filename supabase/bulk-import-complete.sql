-- Complete Bulk Import Script
-- Run this in Supabase SQL Editor
-- This will import all 140+ client records with cases and comments

DO `$`$
DECLARE
  v_status_id uuid;
  v_user_id uuid;
  v_client_id uuid;
  v_case_id uuid;
BEGIN
  SELECT id INTO v_status_id FROM status WHERE name = ''New'' LIMIT 1;
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  -- Record 1
  v_client_id := gen_random_uuid();
  INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, ''Damjan'', ''Testing'');
  INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, ''+48123456789'', true);
  INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id;
  INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false);
  INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, ''Immigration Form - WhatsApp Message'');

  -- Record 2
  v_client_id := gen_random_uuid();
  INSERT INTO clients (id, first_name, last_name) VALUES (v_client_id, ''Rakib'', ''Hossain'');
  INSERT INTO contact_numbers (client_id, number, is_on_whatsapp) VALUES (v_client_id, ''+48579282315'', true);
  INSERT INTO cases (client_id, status_id) VALUES (v_client_id, v_status_id) RETURNING id INTO v_case_id;
  INSERT INTO installments (case_id, amount, position, is_down_payment, automatic_invoice) VALUES (v_case_id, 0, 1, true, false);
  INSERT INTO comments (case_id, user_id, text) VALUES (v_case_id, v_user_id, ''Home Form - WhatsApp Call'');

