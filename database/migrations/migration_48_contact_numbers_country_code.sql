-- Migration 48: Add country_code column to contact_numbers table
-- This allows storing phone country codes separately from the phone number
-- Date: 2025-02-01

-- Add the country_code column to contact_numbers table
ALTER TABLE contact_numbers 
ADD COLUMN IF NOT EXISTS country_code TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN contact_numbers.country_code IS 'Phone country code (e.g., +48, +1, +44)';

-- ============================================================================
-- UPDATE THE TRIGGER FUNCTION THAT CREATES CLIENTS FROM FORM SUBMISSIONS
-- ============================================================================
-- This function is triggered when a new form submission is inserted.
-- It now properly stores the phone_country_code in the contact_numbers table.

CREATE OR REPLACE FUNCTION create_client_from_submission()
RETURNS TRIGGER AS $$
DECLARE
    new_client_id UUID;
    name_parts TEXT[];
    first_name_val TEXT;
    last_name_val TEXT;
BEGIN
    -- Only process new submissions that haven't been converted yet
    IF NEW.client_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Split full_name into first and last name
    name_parts := string_to_array(COALESCE(NEW.full_name, ''), ' ');
    first_name_val := name_parts[1];
    last_name_val := array_to_string(name_parts[2:], ' ');

    -- Create the new client
    INSERT INTO clients (first_name, last_name, contact_email)
    VALUES (first_name_val, NULLIF(last_name_val, ''), NEW.email)
    RETURNING id INTO new_client_id;

    -- Add phone number with country code if provided
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
        INSERT INTO contact_numbers (client_id, number, country_code, is_on_whatsapp)
        VALUES (new_client_id, NEW.phone, NEW.phone_country_code, false);
    END IF;

    -- Update the form submission with the client reference
    UPDATE form_submissions
    SET client_id = new_client_id
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists (create if not exists pattern)
DROP TRIGGER IF EXISTS trigger_create_client_from_submission ON form_submissions;

CREATE TRIGGER trigger_create_client_from_submission
AFTER INSERT ON form_submissions
FOR EACH ROW
EXECUTE FUNCTION create_client_from_submission();
