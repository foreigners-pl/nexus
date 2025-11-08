-- Migration 8: Make Client Names Nullable
-- Allows creating clients with only email or phone number

-- Make first_name nullable
ALTER TABLE clients ALTER COLUMN first_name DROP NOT NULL;

-- Make last_name nullable
ALTER TABLE clients ALTER COLUMN last_name DROP NOT NULL;

-- Add a check constraint to ensure at least some identifying information exists
-- (This is a soft constraint - enforced in application logic)
COMMENT ON TABLE clients IS 'At least one of first_name, last_name, contact_email, or a contact_number must be provided';

-- Migration complete!
