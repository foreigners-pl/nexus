# User System Synchronization

## Overview

Your application uses **two user tables**:

1. **uth.users** - Managed by Supabase for authentication
2. **public.users** - Your custom table for user profiles and additional data

These tables are automatically synchronized using database triggers.

## Why Two Tables?

### uth.users (Supabase Managed)
-  Handles all authentication (login, logout, sessions)
-  Email verification and password resets
-  OAuth providers (Google, GitHub, etc.)
-  Security tokens and session management
-  Cannot be directly modified or joined in your queries
-  Limited fields (id, email, auth metadata)

### public.users (Your Custom Table)
-  Store additional profile data (display_name, contact_number, theme, role)
-  Can be queried and joined with other tables (cases, boards, etc.)
-  Full control over schema and fields
-  Can add custom indexes and constraints
-  Doesn't handle authentication

## How Synchronization Works

### Automatic Sync (Database Triggers)

When a user signs up or their auth data changes:

1. **User signs up via Supabase Auth**
   \\\
   auth.users (INSERT)
   
   TRIGGER: on_auth_user_created
   
   public.users (AUTO-INSERT with same ID)
   \\\

2. **User deletes their account**
   \\\
   auth.users (DELETE)
   
   TRIGGER: on_auth_user_deleted
   
   public.users (AUTO-DELETE)
   \\\

### What Gets Synced Automatically

- **ID**: Same UUID in both tables (primary key)
- **Email**: Copied from auth.users
- **Display Name**: Extracted from:
  1. \uth.users.raw_user_meta_data->>'display_name'\
  2. \uth.users.raw_user_meta_data->>'full_name'\
  3. Email prefix (everything before @)

### Manual Sync for Existing Users

The migration includes a one-time sync:
\\\sql
-- Sync any existing auth.users that don't have a public.users entry
INSERT INTO public.users (id, email, display_name, ...)
SELECT ...
FROM auth.users
WHERE NOT EXISTS (...)
\\\

## Usage in Your Code

### Get Current User Profile
\\\	ypescript
import { getCurrentUserProfile } from '@/app/actions/users'

const result = await getCurrentUserProfile()
if (result.data) {
  console.log(result.data.display_name)
  console.log(result.data.contact_number)
}
\\\

### Update User Profile
\\\	ypescript
import { updateUserProfile } from '@/app/actions/users'

const result = await updateUserProfile({
  display_name: 'John Doe',
  contact_number: '+1234567890'
})
\\\

### Query Users in Your Tables
\\\	ypescript
// This works because public.users can be queried and joined
const { data } = await supabase
  .from('case_assignees')
  .select(\
    *,
    users (
      id,
      email,
      display_name
    )
  \)
\\\

## Database Setup

### 1. Run the Migration

Execute \database/15_users.sql\ in your Supabase SQL editor:

\\\ash
# This will:
# - Create/update the users table
# - Set up automatic sync triggers
# - Sync existing auth.users
# - Enable Row Level Security
\\\

### 2. Verify the Sync

\\\sql
-- Check that all auth users have profile entries
SELECT 
  au.id,
  au.email as auth_email,
  pu.email as profile_email,
  pu.display_name
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id;
\\\

### 3. Test with a New User

1. Create a new user via your signup form
2. Check that \public.users\ automatically gets an entry with the same ID
3. Verify display_name is populated

## Row Level Security (RLS)

The users table has these policies:

- **View All Users**: Anyone can view user profiles (needed for assignees, sharing)
- **Update Own Profile**: Users can only update their own profile
- **Authenticated Only**: Only logged-in users can access

## Common Patterns

### Displaying User Info
\\\	ypescript
// In your components
const { data: users } = await supabase
  .from('users')
  .select('id, display_name, email')
  
// Show in dropdown
{users.map(u => (
  <option value={u.id}>{u.display_name || u.email}</option>
))}
\\\

### Assignee/Sharing Features
\\\	ypescript
// Get users for sharing
const { data: availableUsers } = await supabase
  .from('users')
  .select('*')
  .order('display_name', { ascending: true })
\\\

### User References
All your tables that reference users use the ID:
- \case_assignees.user_id\  \users.id\
- \oard_access.user_id\  \users.id\
- \card_assignees.user_id\  \users.id\

## Troubleshooting

### User profile missing after signup?

Run the fallback function:
\\\	ypescript
import { ensureUserProfile } from '@/app/actions/users'
await ensureUserProfile()
\\\

### Display name not showing?

Update it manually:
\\\	ypescript
await updateUserProfile({ 
  display_name: 'Preferred Name' 
})
\\\

### Sync not working for new users?

1. Check triggers exist:
   \\\sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%auth_user%';
   \\\

2. Verify trigger functions:
   \\\sql
   SELECT * FROM pg_proc WHERE proname LIKE '%handle_new_user%';
   \\\

3. Re-run the migration if needed

## Migration Checklist

- [ ] Run \database/15_users.sql\ in Supabase
- [ ] Verify triggers are created
- [ ] Check existing users are synced
- [ ] Test signup creates profile
- [ ] Test profile updates work
- [ ] Verify RLS policies are active

## Future Enhancements

Consider adding:
- Profile photos/avatars
- User preferences (notifications, language)
- Last seen timestamp
- User status (active, suspended)
- Role-based permissions

