-- Migration 7: Add Custom Case Codes
-- This adds a human-readable case code like C0000001, C0000002, etc.

-- Add case_code column
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_code TEXT UNIQUE;

-- Create a sequence for case codes
CREATE SEQUENCE IF NOT EXISTS case_code_seq START WITH 1;

-- Function to generate case code
CREATE OR REPLACE FUNCTION generate_case_code()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    new_code TEXT;
BEGIN
    next_num := nextval('case_code_seq');
    new_code := 'C' || LPAD(next_num::TEXT, 7, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger function (must be created before the trigger)
CREATE OR REPLACE FUNCTION generate_case_code_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.case_code := generate_case_code();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS set_case_code ON cases;

-- Create trigger to auto-generate case code on insert
CREATE TRIGGER set_case_code
    BEFORE INSERT ON cases
    FOR EACH ROW
    WHEN (NEW.case_code IS NULL)
    EXECUTE FUNCTION generate_case_code_trigger();

-- Update existing cases with codes
DO $$
DECLARE
    case_record RECORD;
BEGIN
    FOR case_record IN 
        SELECT id FROM cases WHERE case_code IS NULL ORDER BY created_at
    LOOP
        UPDATE cases 
        SET case_code = generate_case_code()
        WHERE id = case_record.id;
    END LOOP;
END $$;

-- Create index on case_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_cases_case_code ON cases(case_code);

-- Migration complete!
