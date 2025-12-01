-- Migration 27: Create wiki folders and update wiki_documents structure
-- Run this in Supabase SQL editor

-- Create wiki_folders table (the folders/wikis that contain documents)
CREATE TABLE IF NOT EXISTS wiki_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_shared boolean NOT NULL DEFAULT false,
  shared_with uuid[] DEFAULT '{}', -- Array of user IDs (if shared)
  position integer NOT NULL DEFAULT 0, -- For custom ordering
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_or_shared CHECK (owner_id IS NOT NULL OR is_shared = true)
);

-- Add position column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wiki_folders' AND column_name = 'position'
  ) THEN
    ALTER TABLE wiki_folders ADD COLUMN position integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add folder_id to wiki_documents (instead of parent_id)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wiki_documents' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE wiki_documents ADD COLUMN folder_id uuid REFERENCES wiki_folders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Remove the old parent_id column if it exists
ALTER TABLE wiki_documents DROP COLUMN IF EXISTS parent_id;

-- Drop any old triggers that might reference parent_id
DROP TRIGGER IF EXISTS enforce_wiki_nesting_level ON wiki_documents;
DROP FUNCTION IF EXISTS check_wiki_nesting_level();

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_wiki_documents_folder_id ON wiki_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_wiki_folders_owner_id ON wiki_folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_wiki_folders_is_shared ON wiki_folders(is_shared);

-- Create wiki_folder_access table for sharing wikis with specific users
CREATE TABLE IF NOT EXISTS wiki_folder_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES wiki_folders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('editor', 'viewer')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(folder_id, user_id)
);

-- Create indexes for wiki_folder_access
CREATE INDEX IF NOT EXISTS idx_wiki_folder_access_folder_id ON wiki_folder_access(folder_id);
CREATE INDEX IF NOT EXISTS idx_wiki_folder_access_user_id ON wiki_folder_access(user_id);

-- Update existing folders that have shared users to mark them as shared
UPDATE wiki_folders
SET is_shared = true
WHERE id IN (
  SELECT DISTINCT folder_id 
  FROM wiki_folder_access
)
AND is_shared = false;

