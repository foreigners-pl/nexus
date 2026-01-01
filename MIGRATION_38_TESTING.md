# Migration 38: Board Access RLS Fix - Testing Guide

## Overview

**Migration 38** fixes the infinite recursion issue in `board_access` Row-Level Security (RLS) policies that was preventing board sharing from working.

## The Problem We Fixed

### Root Cause
Migration 37 created a `user_can_manage_board()` function that queries the `board_access` table, but this function was called FROM RLS policies ON the `board_access` table itself. This created infinite recursion:

```
User tries to share board
  → INSERT policy on board_access checks permissions
    → Calls user_can_manage_board() function
      → Function queries board_access table
        → RLS policy triggers again
          → Calls user_can_manage_board() again
            → INFINITE LOOP 💥
```

### Symptoms
- Error: `"new row violates row-level security policy for table 'board_access'"`
- Unable to share boards with collaborators
- All boards showing as "Private" even when shared

## The Solution

### Key Insight
**RLS policies on a table CANNOT call functions that query that same table** - even with `SECURITY DEFINER`. This creates recursion.

### What We Changed

1. **Removed the problematic function**: Dropped `user_can_manage_board()`

2. **Simplified policies**: `board_access` policies now ONLY check the `boards` table:
   ```sql
   -- Before (BROKEN - caused recursion)
   WITH CHECK (public.user_can_manage_board(board_id, auth.uid()))
   
   -- After (WORKS - no recursion)
   WITH CHECK (
     EXISTS (
       SELECT 1 FROM boards
       WHERE boards.id = board_id
       AND boards.owner_id = auth.uid()
     )
   )
   ```

3. **Trade-off**: Only board **OWNERS** can now share/manage access (not editors)
   - This is safer and simpler
   - Editors can still view/edit the board, just can't share it

## Files Changed

### Database
- ✅ `database/migrations/migration_38_fix_board_access_recursion.sql` - New migration

### Backend
- ✅ `app/actions/board/helpers.ts` - Added `isBoardOwner()` helper
- ✅ `app/actions/board/sharing.ts` - Updated to only allow owners to share
- ✅ `app/actions/board/core.ts` - Removed debug console.log statements

### Frontend
- ✅ `app/(dashboard)/board/components/ShareBoardModal.tsx` - Updated to only show "Add User" section to owners

## How to Apply

### Step 1: Run Migration 38

In Supabase SQL Editor:

```bash
database/migrations/migration_38_fix_board_access_recursion.sql
```

Or run directly:
```sql
-- Copy the entire content of migration_38_fix_board_access_recursion.sql
```

### Step 2: Verify Migration Applied

Run this query in Supabase SQL Editor:

```sql
-- Check that user_can_manage_board function is gone
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'user_can_manage_board';
-- Should return no rows

-- Check board_access policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'board_access';
-- Should show 4 policies:
--   1. Users can view their own board access (SELECT)
--   2. Board owners can share boards (INSERT)
--   3. Board owners can remove access (DELETE)
--   4. Board owners can update access (UPDATE)
```

### Step 3: Test the Application

Deploy the updated code and test thoroughly.

## Testing Checklist

### ✅ Basic Board Sharing (Owner)

1. **Login as User A (will be board owner)**
   - Navigate to Boards
   - Create a new board named "Test Board"
   
2. **Share the board**
   - Click the "Share" button on the board
   - You should see the Share modal
   - Select User B from the dropdown
   - Choose "Editor" access level
   - Click "Add User"
   - ✅ Should succeed without errors
   - ✅ User B should appear in the collaborators list

3. **Verify sharing worked**
   - Check that User B shows as "editor" in the access list
   - Board should now show as "Shared" (not "Private")

### ✅ Board Access (Editor)

1. **Login as User B (editor)**
   - Navigate to Boards
   - ✅ "Test Board" should appear in your board list
   - ✅ Board should show access level: "Editor"
   
2. **Test editor permissions**
   - Open "Test Board"
   - ✅ Can create new cards
   - ✅ Can edit existing cards
   - ✅ Can move cards between statuses
   - ✅ Can assign users to cards

3. **Test editor limitations (after migration 38)**
   - Click the "Share" button
   - ✅ Should NOT see the "Add User" section
   - ✅ Should only see the list of current collaborators
   - This is expected - only owners can share

### ✅ Board Access (Viewer)

1. **Login as User A (owner)**
   - Share "Test Board" with User C
   - Choose "Viewer" access level

2. **Login as User C (viewer)**
   - Open "Test Board"
   - ✅ Can see all cards
   - ✅ Can see card details
   - ❌ Cannot create cards
   - ❌ Cannot edit cards
   - ❌ Cannot move cards
   - ❌ Cannot assign cards

### ✅ Removing Access

1. **Login as User A (owner)**
   - Open the Share modal for "Test Board"
   - Find User B in the collaborators list
   - Click "Remove"
   - Confirm the removal
   - ✅ Should succeed
   - ✅ User B should disappear from the list

2. **Login as User B**
   - Navigate to Boards
   - ✅ "Test Board" should no longer appear
   - ✅ Cannot access the board via direct URL

### ✅ Board Assignees

1. **Login as User A (owner)**
   - Open "Test Board"
   - Create a card
   - Click to add assignees
   - ✅ Should see all collaborators (A, C) in the dropdown
   - ✅ Can assign User C to the card

2. **Login as User C (viewer)**
   - Open the assigned card
   - ✅ Should see themselves as assigned

### ✅ System Boards

1. **Login as any user**
   - ✅ Can see system boards (if any exist)
   - ✅ Can view cards on system boards
   - Permissions depend on board_access settings

### ✅ Edge Cases

1. **Non-owner cannot share**
   - Login as User B (if still has access)
   - Open a board they don't own
   - ✅ Share button should not show "Add User" section

2. **Owner cannot remove themselves**
   - Login as board owner
   - Try to remove own access
   - ✅ Should not see "Remove" button for self

3. **Cannot access boards without permission**
   - Login as User D (no access)
   - Navigate directly to a board URL
   - ✅ Should get "Board not found" or redirect

## Security Verification

### RLS is Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('boards', 'board_access', 'cards', 'card_assignees');
-- All should show rowsecurity = true
```

### Policies are Correct
```sql
-- Board access policies should NOT query board_access table
SELECT policyname, pg_get_expr(qual, 'board_access'::regclass) as using_clause
FROM pg_policies 
WHERE tablename = 'board_access';
-- None of the clauses should contain "board_access" (preventing recursion)
```

## Rollback Plan

If migration 38 causes issues, you can rollback by:

1. **Disable RLS temporarily** (emergency fix):
   ```sql
   ALTER TABLE board_access DISABLE ROW LEVEL SECURITY;
   ```

2. **Or restore migration 36 state**:
   ```sql
   -- Run migration_36_EMERGENCY_FIX_boards.sql
   ```

## Known Limitations

### Only Owners Can Share (Not Editors)

**Before Migration 38**: Editors could share boards  
**After Migration 38**: Only owners can share boards

**Why?** Allowing editors to share would require querying `board_access` FROM a policy ON `board_access`, causing recursion.

**Workaround**: If you need editors to share:
1. Promote them to owner role temporarily
2. Have the owner share on their behalf
3. Use a separate permissions tracking table (complex)

**Is this a problem?** For most use cases, **no**:
- Editors can still fully use the board (view, edit, create, assign)
- Owners maintain control over who can access their boards
- This matches common collaboration patterns (e.g., Google Docs has "Can edit" vs "Can share")

## Related Migrations

- **Migration 23**: Created `user_has_board_access()` - Still used for board SELECT policy ✅
- **Migration 24**: Created card access functions - Still working correctly ✅
- **Migration 33**: Created `user_can_assign_card()` - Still working correctly ✅
- **Migration 35**: Created `get_board_user_ids()` - Still working correctly ✅
- **Migration 36**: Emergency fix (disabled all RLS) - Now superseded by migration 38 ✅
- **Migration 37**: Re-enabled RLS but had recursion bug - Fixed by migration 38 ✅

## Success Criteria

Migration 38 is successful when:

- ✅ Board sharing works without errors
- ✅ Shared boards show correct status (not "Private")
- ✅ Collaborators can access shared boards
- ✅ Access levels work correctly (Owner/Editor/Viewer)
- ✅ Only owners can share/remove access
- ✅ Assignee dropdown shows all collaborators
- ✅ No infinite recursion errors in logs
- ✅ RLS policies are enabled on all board tables

## Troubleshooting

### "New row violates RLS policy" error persists
- Check that migration 38 was fully applied
- Verify `user_can_manage_board` function is deleted
- Check policy definitions match migration 38

### Cannot share boards at all
- Verify you're logged in as the board owner
- Check browser console for errors
- Verify RLS is enabled: `SELECT * FROM pg_tables WHERE tablename = 'board_access'`

### Boards not showing up
- Check RLS policies on `boards` table
- Verify `user_has_board_access()` function exists
- Test direct database query to isolate issue

### Collaborators not appearing in assignee dropdown
- Verify `get_board_user_ids()` function exists and works
- Check that function has `SECURITY DEFINER` attribute
- Test function directly: `SELECT get_board_user_ids('board-uuid-here')`
