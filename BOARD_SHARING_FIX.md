# Board Sharing RLS Policy Fix

## Problem

When trying to share a board with another user, you were getting this error:

\\\
new row violates row-level security policy for table "board_access"
\\\

## Root Cause

The Row Level Security (RLS) policy on \oard_access\ table was too restrictive:

\\\sql
-- OLD POLICY (Too Restrictive)
CREATE POLICY "Users can view board access"
ON board_access FOR SELECT
USING (user_id = auth.uid());
\\\

This policy only allowed users to see **their own** access records. 

### Why This Caused the Error

When you insert a new row into a table with RLS enabled, PostgreSQL:
1. Inserts the row
2. Immediately checks if the **current user** can SELECT that row
3. If the SELECT policy fails, the INSERT is rolled back

So when user1 tried to share with user2:
- INSERT creates a row with \user_id = user2_id\
- PostgreSQL checks: "Can user1 see this row?"
- Policy says: "Only if \user_id = user1_id\"
- Since \user2_id  user1_id\, the check fails
- INSERT is rolled back with RLS error

## Solution

Updated the RLS policy to allow **board owners** to view all access records for their boards:

\\\sql
-- NEW POLICY (Allows Board Owners to View All Access)
CREATE POLICY "Users can view board access"
ON board_access FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = board_access.board_id
    AND boards.owner_id = auth.uid()
  )
);
\\\

This allows:
1.  Users to view their own access records
2.  Board owners to view ALL access records for their boards

## How to Apply the Fix

### Step 1: Run the Migration

In your Supabase SQL Editor, run:

\\\ash
database/migrations/migration_22_fix_board_access_policy.sql
\\\

Or copy and paste this SQL:

\\\sql
-- Drop the current restrictive policy
DROP POLICY IF EXISTS "Users can view board access" ON board_access;

-- Create new policy that allows board owners to see all access
CREATE POLICY "Users can view board access"
ON board_access FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = board_access.board_id
    AND boards.owner_id = auth.uid()
  )
);
\\\

### Step 2: Verify the Fix

1. Log in as user1
2. Create or open a board (you'll be the owner)
3. Click the "Share" button
4. Select user2 from the dropdown
5. Choose access level (Editor or Viewer)
6. Click "Add User"
7.  Should work without errors!

### Step 3: Test the Access

1. Log in as user2
2. Navigate to the board list
3. You should see the shared board
4. Open the board
5. Depending on access level:
   - **Editor**: Can edit tasks and statuses
   - **Viewer**: Can only view

## Security Implications

This change is **secure** because:

1.  Only **board owners** can see all access records for their boards
2.  Users can still only see their own access records for boards they don't own
3.  The INSERT policy still prevents non-owners from granting access
4.  The DELETE policy still prevents non-owners from revoking access

## Testing Checklist

- [ ] Run migration in Supabase
- [ ] Verify policy exists: \SELECT * FROM pg_policies WHERE tablename = 'board_access';\
- [ ] Test sharing board with another user
- [ ] Confirm no RLS error occurs
- [ ] Verify shared user can access the board
- [ ] Verify access levels work correctly (Editor vs Viewer)
- [ ] Confirm non-owners cannot share boards they don't own

## Related Files

- **Migration**: \database/migrations/migration_22_fix_board_access_policy.sql\
- **Share Modal**: \pp/(dashboard)/board/components/ShareBoardModal.tsx\
- **Board Actions**: \pp/actions/boards.ts\
- **Original Migration**: \database/migrations/migration_21_create_boards_system.sql\

