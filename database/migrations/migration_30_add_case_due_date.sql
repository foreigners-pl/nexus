-- Migration 30: Add due_date column to cases table
-- Run this in Supabase SQL Editor

-- Add due_date column
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS due_date date;

-- Add index for faster queries on due dates
CREATE INDEX IF NOT EXISTS idx_cases_due_date ON cases(due_date) WHERE due_date IS NOT NULL;

-- Add comment
COMMENT ON COLUMN cases.due_date IS 'Optional due date for the case';