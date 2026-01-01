-- Migration 31: Add position column to cases table for drag-and-drop ordering
-- Run this in Supabase SQL Editor

-- Add position column with default value
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Set initial positions based on created_at (older cases get lower positions)
WITH numbered_cases AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY status_id ORDER BY created_at) - 1 AS new_position
  FROM cases
)
UPDATE cases
SET position = numbered_cases.new_position
FROM numbered_cases
WHERE cases.id = numbered_cases.id;

-- Add index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_cases_position ON cases(status_id, position);

-- Add comment
COMMENT ON COLUMN cases.position IS 'Position of case within its status column for drag-and-drop ordering';