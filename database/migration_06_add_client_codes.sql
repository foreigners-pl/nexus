-- Migration 6: Add Custom Client Codes
-- This adds a human-readable client code like CL000001, CL000002, etc.

-- Add client_code column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_code TEXT UNIQUE;

-- Create a sequence for client codes
CREATE SEQUENCE IF NOT EXISTS client_code_seq START WITH 1;

-- Function to generate client code
CREATE OR REPLACE FUNCTION generate_client_code()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    new_code TEXT;
BEGIN
    next_num := nextval('client_code_seq');
    new_code := 'CL' || LPAD(next_num::TEXT, 6, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger function (must be created before the trigger)
CREATE OR REPLACE FUNCTION generate_client_code_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.client_code := generate_client_code();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS set_client_code ON clients;

-- Create trigger to auto-generate client code on insert
CREATE TRIGGER set_client_code
    BEFORE INSERT ON clients
    FOR EACH ROW
    WHEN (NEW.client_code IS NULL)
    EXECUTE FUNCTION generate_client_code_trigger();

-- Update existing clients with codes
DO $$
DECLARE
    client_record RECORD;
BEGIN
    FOR client_record IN 
        SELECT id FROM clients WHERE client_code IS NULL ORDER BY created_at
    LOOP
        UPDATE clients 
        SET client_code = generate_client_code()
        WHERE id = client_record.id;
    END LOOP;
END $$;

-- Create index on client_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_clients_client_code ON clients(client_code);

-- Migration complete!
