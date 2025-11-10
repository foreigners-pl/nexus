-- Add foreign key relationship between card_assignees and users table
ALTER TABLE card_assignees
ADD CONSTRAINT card_assignees_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE;
