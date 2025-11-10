'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Get current user's profile
 */
export async function getCurrentUserProfile() {
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (error) return { error: error.message }
  
  return { data }
}

/**
 * Update current user's profile
 */
export async function updateUserProfile(updates: {
  display_name?: string
  contact_number?: string
  theme?: string
  role?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const updateData: any = {}
  if (updates.display_name !== undefined) updateData.display_name = updates.display_name
  if (updates.contact_number !== undefined) updateData.contact_number = updates.contact_number
  if (updates.theme !== undefined) updateData.theme = updates.theme
  if (updates.role !== undefined) updateData.role = updates.role
  
  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return { error: error.message }
  
  return { data }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return { error: error.message }
  
  return { data }
}

/**
 * Check if user profile exists, create if not
 * This is a fallback in case the trigger didn't work
 */
export async function ensureUserProfile() {
  const supabase = await createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Not authenticated' }

  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from('users')
    .select('id')
    .eq('id', authUser.id)
    .single()

  if (existingProfile) {
    return { data: existingProfile }
  }

  // Create profile if it doesn't exist
  const displayName = authUser.user_metadata?.display_name 
    || authUser.user_metadata?.full_name 
    || authUser.email?.split('@')[0]
    || 'User'

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authUser.id,
      email: authUser.email || '',
      display_name: displayName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) return { error: error.message }
  
  return { data }
}
