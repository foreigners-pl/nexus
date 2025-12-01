-- Migration: Create wiki_documents table for Wiki feature
-- Run this in Supabase SQL editor or psql

CREATE TABLE wiki_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content jsonb NOT NULL, -- Rich text editor output (Tiptap/Quill/Draft.js)
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES wiki_documents(id) ON DELETE CASCADE, -- Parent document (null for top-level)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_shared boolean NOT NULL DEFAULT false,
  shared_with uuid[] DEFAULT '{}', -- Array of user IDs (if shared)
  -- Optionally: add tags, attachments, etc.
  -- Optionally: add a deleted_at for soft delete
  CONSTRAINT owner_or_shared CHECK (owner_id IS NOT NULL OR is_shared = true),
  -- Prevent nested children: if this doc has a parent, it cannot be a parent itself
  CONSTRAINT no_nested_children CHECK (
    parent_id IS NULL OR 
    id NOT IN (SELECT parent_id FROM wiki_documents WHERE parent_id IS NOT NULL)
  )
);

-- Create index for faster parent-child queries
CREATE INDEX idx_wiki_documents_parent_id ON wiki_documents(parent_id);

-- Create a trigger to enforce one-level nesting
CREATE OR REPLACE FUNCTION check_wiki_nesting_level()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to set a parent_id, check that the parent itself has no parent
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM wiki_documents WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Cannot nest documents more than one level deep';
    END IF;
  END IF;
  
  -- If this document has children, prevent it from getting a parent
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM wiki_documents WHERE parent_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot make a parent document into a child';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_wiki_nesting_level
  BEFORE INSERT OR UPDATE ON wiki_documents
  FOR EACH ROW
  EXECUTE FUNCTION check_wiki_nesting_level();