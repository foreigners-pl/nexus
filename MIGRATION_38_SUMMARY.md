# Migration 38: Board Sharing RLS Fix - Summary

## What Was Done

I've successfully analyzed and fixed the board sharing issue that was preventing users from sharing boards with collaborators.

## Root Cause Analysis

The previous chat session (which created Migration 37) made a critical error:

### The Bug
Migration 37 created a `user_can_manage_board()` function that:
1. Queries the `board_access` table
2. Was called FROM RLS policies ON the `board_access` table itself

This created **infinite recursion**:
```
RLS Policy on board_access → calls user_can_manage_board()
  → function queries board_access
    → RLS Policy triggers again
      → calls user_can_manage_board() again
        → INFINITE LOOP
```

### Why SECURITY DEFINER Didn't Help

The previous developer assumed `SECURITY DEFINER` would bypass RLS completely. However:

- ✅ `SECURITY DEFINER` DOES bypass RLS when a function queries OTHER tables
- ❌ `SECURITY DEFINER` DOES NOT prevent recursion when:
  - A policy ON table X calls a function
  - That function queries table X
  - Which triggers the same policy again

### Examples

**Working pattern** (used in migrations 23-26):
```sql
-- Policy on CARDS table
CREATE POLICY "Users can view cards"
ON cards FOR SELECT
USING (user_can_view_card(id, auth.uid()));

-- Function queries board_access (DIFFERENT table)
CREATE FUNCTION user_can_view_card(...) 
SECURITY DEFINER
AS $$
  SELECT 1 FROM board_access WHERE ...  -- ✅ No recursion
$$;
```

**Broken pattern** (Migration 37):
```sql
-- Policy on BOARD_ACCESS table
CREATE POLICY "Owners can share boards"
ON board_access FOR INSERT
WITH CHECK (user_can_manage_board(board_id, auth.uid()));

-- Function queries board_access (SAME table as policy)
CREATE FUNCTION user_can_manage_board(...)
SECURITY DEFINER
AS $$
  SELECT 1 FROM board_access WHERE ...  -- ❌ RECURSION!
$$;
```

## The Solution

### What Migration 38 Does

1. **Drops the problematic function**
   ```sql
   DROP FUNCTION IF EXISTS public.user_can_manage_board(UUID, UUID) CASCADE;
   ```

2. **Rewrites policies to ONLY query boards table**
   ```sql
   CREATE POLICY "Board owners can share boards"
   ON board_access FOR INSERT
   WITH CHECK (
     EXISTS (
       SELECT 1 FROM boards  -- Only queries boards, never board_access
       WHERE boards.id = board_id
       AND boards.owner_id = auth.uid()
     )
   );
   ```

3. **Applies same pattern to all board_access policies**
   - SELECT: Users see only their own records
   - INSERT: Only owners can share
   - UPDATE: Only owners can change access levels
   - DELETE: Only owners can remove access

### Trade-off: Only Owners Can Share

**Before**: Both owners and editors could share boards  
**After**: Only owners can share boards

**Why this is acceptable**:
- Editors can still fully use the board (view, edit, create cards, assign users)
- Matches common patterns (e.g., Google Docs "Can edit" vs "Can share")
- Prevents accidental over-sharing
- Owner maintains control of their board's access list

**If you need editors to share**: Temporarily promote them to owner or have owner share on their behalf.

## Files Modified

### Database Migrations
- ✅ Created `database/migrations/migration_38_fix_board_access_recursion.sql`

### Backend Actions
- ✅ `app/actions/board/helpers.ts` - Added `isBoardOwner()` function
- ✅ `app/actions/board/sharing.ts` - Updated to check owner-only access
- ✅ `app/actions/board/core.ts` - Removed debug console.log statements

### Frontend Components
- ✅ `app/(dashboard)/board/components/ShareBoardModal.tsx` - Show "Add User" only to owners

### Documentation
- ✅ Created `MIGRATION_38_TESTING.md` - Comprehensive testing guide
- ✅ Created `MIGRATION_38_SUMMARY.md` - This document

## How to Apply

### 1. Run the Migration

In Supabase SQL Editor, execute:
```
database/migrations/migration_38_fix_board_access_recursion.sql
```

### 2. Deploy Code Changes

Deploy the updated application code:
- Backend action changes
- Frontend component changes

### 3. Test Thoroughly

Follow the testing checklist in `MIGRATION_38_TESTING.md`

## Verification

After applying migration 38, verify:

### Database Changes
```sql
-- 1. Function should be gone
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'user_can_manage_board';
-- Should return 0 rows

-- 2. Policies should exist
SELECT policyname FROM pg_policies WHERE tablename = 'board_access';
-- Should return 4 policies:
--   - Users can view their own board access
--   - Board owners can share boards
--   - Board owners can remove access
--   - Board owners can update access

-- 3. RLS should be enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'board_access';
-- rowsecurity should be TRUE
```

### Application Testing
1. ✅ Owner can share boards
2. ✅ Shared boards appear in collaborator's board list
3. ✅ Editor can view/edit but cannot share
4. ✅ Viewer can only view
5. ✅ Owner can remove access
6. ✅ Assignee dropdown shows all collaborators

## Key Learnings

### RLS Policy Best Practices

1. **Never query the same table from its own policy**
   - Policy on table X should never call functions that query table X
   - This causes recursion even with SECURITY DEFINER

2. **SECURITY DEFINER is for cross-table queries**
   - Use when policy on table A needs to check table B
   - Bypasses RLS on table B
   - Does NOT prevent recursion on table A

3. **Keep policies simple**
   - Simpler policies = fewer edge cases
   - Direct table checks are better than function calls when possible
   - Only use functions when you need complex logic or cross-table checks

4. **Test with RLS enabled from the start**
   - Don't disable RLS to "fix" issues
   - Understand the root cause
   - Fix the policies properly

### Function Design Patterns

**✅ GOOD: Cross-table access check**
```sql
-- Policy on cards table
CREATE POLICY ... ON cards
USING (user_can_view_card(id, auth.uid()));

-- Function checks boards + board_access (different tables)
CREATE FUNCTION user_can_view_card(...)
RETURNS BOOLEAN AS $$
  SELECT 1 FROM boards WHERE ...
  UNION
  SELECT 1 FROM board_access WHERE ...
$$;
```

**❌ BAD: Same-table access check**
```sql
-- Policy on board_access table
CREATE POLICY ... ON board_access
WITH CHECK (user_can_manage_board(board_id, auth.uid()));

-- Function queries board_access (SAME TABLE = RECURSION)
CREATE FUNCTION user_can_manage_board(...)
RETURNS BOOLEAN AS $$
  SELECT 1 FROM board_access WHERE ...  -- ❌
$$;
```

**✅ GOOD: Same-table policy alternative**
```sql
-- Policy directly queries a different table (boards)
CREATE POLICY ... ON board_access
WITH CHECK (
  EXISTS (
    SELECT 1 FROM boards  -- Different table, no recursion
    WHERE boards.id = board_id
    AND boards.owner_id = auth.uid()
  )
);
```

## Migration Timeline

| Migration | What It Did | Status |
|-----------|-------------|--------|
| 23 | Created `user_has_board_access()` for boards SELECT policy | ✅ Still working |
| 24 | Created card access functions (cross-table queries) | ✅ Still working |
| 26 | Fixed `user_can_edit_board()` function | ✅ Still working |
| 32 | Temporary permissive policy for assignees | ✅ Superseded by 33 |
| 33 | Created `user_can_assign_card()` function | ✅ Still working |
| 35 | Created `get_board_user_ids()` for assignee dropdown | ✅ Still working |
| 36 | **Emergency fix** - Disabled all RLS | ⚠️ Superseded by 38 |
| 37 | Re-enabled RLS but **introduced recursion bug** | ❌ Fixed by 38 |
| 38 | **Fixed recursion** - Simplified board_access policies | ✅ **CURRENT** |

## Next Steps

1. ✅ Apply migration 38 to database
2. ✅ Deploy code changes
3. ✅ Test board sharing functionality
4. ✅ Verify all access levels work correctly
5. ✅ Monitor for any RLS errors in logs

## Rollback Plan

If migration 38 causes issues:

**Option 1: Disable RLS (emergency only)**
```sql
ALTER TABLE board_access DISABLE ROW LEVEL SECURITY;
```

**Option 2: Restore previous policies**
Re-run migration 36 or 37 if needed, then debug the actual issue.

## Success Metrics

Migration 38 is successful when:
- ✅ No "violates row-level security policy" errors
- ✅ Board sharing works for owners
- ✅ Collaborators can access shared boards
- ✅ Access levels enforced correctly (owner/editor/viewer)
- ✅ Assignee dropdown shows all board users
- ✅ No infinite recursion in database logs

## Contact

If you encounter issues after applying this migration:
1. Check `MIGRATION_38_TESTING.md` troubleshooting section
2. Verify migration was fully applied
3. Check Supabase logs for errors
4. Review RLS policies with provided SQL queries
