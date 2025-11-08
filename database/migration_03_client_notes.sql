-- Migration 3: Create Client Notes Table
-- This allows staff to add notes about clients (communications, follow-ups, observations)

CREATE TABLE IF NOT EXISTS client_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID, -- No foreign key constraint to users table (auth.users is separate)
    note TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false, -- Pin important notes to the top
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_created_at ON client_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_notes_pinned ON client_notes(is_pinned) WHERE is_pinned = true;

-- Trigger to automatically update updated_at timestamp
-- Drop the trigger first if it exists
DROP TRIGGER IF EXISTS update_client_notes_updated_at ON client_notes;

-- Create or replace the function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger
CREATE TRIGGER update_client_notes_updated_at 
    BEFORE UPDATE ON client_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE client_notes IS 'Internal notes about clients for staff reference';
COMMENT ON COLUMN client_notes.is_pinned IS 'Pinned notes appear at the top of the notes list';

-- Migration complete!
