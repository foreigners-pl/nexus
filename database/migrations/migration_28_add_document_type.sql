-- Migration 28: Add document_type column to wiki_documents
-- Run this in Supabase SQL Editor

-- Add document_type column with default 'rich-text'
ALTER TABLE wiki_documents 
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'rich-text' 
CHECK (document_type IN ('rich-text', 'table', 'whiteboard'));

-- Update existing documents to have rich-text type
UPDATE wiki_documents 
SET document_type = 'rich-text' 
WHERE document_type IS NULL;

-- Create index for faster filtering by type
CREATE INDEX IF NOT EXISTS idx_wiki_documents_type ON wiki_documents(document_type);
