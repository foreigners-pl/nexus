# Migration 38 - Quick Start Guide

## TL;DR

Board sharing was broken due to infinite recursion in RLS policies. Migration 38 fixes this by simplifying the policies. After applying, **only board owners can share** (not editors), but everything else works normally.

## Apply in 3 Steps

### 1. Run Database Migration

Open Supabase SQL Editor and execute:
```
database/migrations/migration_38_fix_board_access_recursion.sql
```

**Expected result:** Query succeeds with no errors

### 2. Deploy Code Changes

Deploy the updated application:
```bash
# If using git
git add .
git commit -m "Fix: Migration 38 - Board sharing RLS recursion"
git push

# Your deployment process will vary
```

### 3. Quick Test

1. Login as a board owner
2. Click "Share" on a board
3. Add a collaborator
4. ✅ Should work without "RLS policy violation" error

## Verify Success

Run this in Supabase SQL Editor:
```sql
-- Should return 0 rows (function removed)
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'user_can_manage_board';

-- Should return 4 policies
SELECT policyname FROM pg_policies WHERE tablename = 'board_access';

-- Should return true
SELECT rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'board_access';
```

## What Changed?

### Permission Model
- **Before:** Owners AND editors could share boards
- **After:** Only owners can share boards
- **Editors still can:** View, edit, create cards, assign users
- **Editors cannot:** Add/remove collaborators

### Technical Fix
- Removed `user_can_manage_board()` function (caused recursion)
- Rewrote `board_access` policies to only check `boards` table
- This prevents infinite recursion

## Need More Info?

- **Full testing guide:** `MIGRATION_38_TESTING.md`
- **Technical details:** `MIGRATION_38_SUMMARY.md`
- **Complete change list:** `MIGRATION_38_CHANGES.md`

## Troubleshooting

### Still getting RLS errors?
1. Verify migration 38 was fully applied
2. Check that `user_can_manage_board` function is deleted:
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'user_can_manage_board';
   ```
3. If function still exists, re-run migration 38

### Boards not showing up?
Check that RLS is enabled:
```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('boards', 'board_access');
```

### Editor cannot share?
This is expected after migration 38. Only owners can share boards now.

## Rollback

If you need to rollback:
```sql
-- Emergency fix (disables RLS)
ALTER TABLE board_access DISABLE ROW LEVEL SECURITY;
```

Then investigate the issue before re-enabling.

## Questions?

Check the comprehensive documentation:
- Full testing procedures: `MIGRATION_38_TESTING.md`
- Root cause analysis: `MIGRATION_38_SUMMARY.md`
- All code changes: `MIGRATION_38_CHANGES.md`
