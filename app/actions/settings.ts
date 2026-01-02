'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ActivityType, ActivityPreferences, DEFAULT_FEED, DEFAULT_EMAIL } from '@/lib/activity-types'

export async function getActivityPreferences(): Promise<{ data?: ActivityPreferences | null; error?: string }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('user_activity_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { error: error.message }
  }
  
  return { data: data as ActivityPreferences | null }
}

export async function updateActivityPreferences(preferences: {
  show_in_feed?: ActivityType[]
  email_notifications?: ActivityType[]
}): Promise<{ data?: ActivityPreferences; error?: string }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase
    .from('user_activity_preferences')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('user_activity_preferences')
      .update({
        show_in_feed: preferences.show_in_feed,
        email_notifications: preferences.email_notifications,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return { error: error.message }
    revalidatePath('/settings')
    return { data: data as ActivityPreferences }
  } else {
    const { data, error } = await supabase
      .from('user_activity_preferences')
      .insert({
        user_id: user.id,
        show_in_feed: preferences.show_in_feed ?? DEFAULT_FEED,
        email_notifications: preferences.email_notifications ?? DEFAULT_EMAIL
      })
      .select()
      .single()

    if (error) return { error: error.message }
    revalidatePath('/settings')
    return { data: data as ActivityPreferences }
  }
}

export async function toggleActivityPreference(
  activityType: ActivityType,
  preferenceType: 'show_in_feed' | 'email_notifications',
  enabled: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: current } = await getActivityPreferences()
  
  const currentFeed = current?.show_in_feed ?? DEFAULT_FEED
  const currentEmail = current?.email_notifications ?? DEFAULT_EMAIL
  
  let newFeed = [...currentFeed]
  let newEmail = [...currentEmail]
  
  if (preferenceType === 'show_in_feed') {
    if (enabled && !newFeed.includes(activityType)) {
      newFeed.push(activityType)
    } else if (!enabled) {
      newFeed = newFeed.filter(t => t !== activityType)
    }
  } else {
    if (enabled && !newEmail.includes(activityType)) {
      newEmail.push(activityType)
    } else if (!enabled) {
      newEmail = newEmail.filter(t => t !== activityType)
    }
  }
  
  return await updateActivityPreferences({
    show_in_feed: newFeed,
    email_notifications: newEmail
  })
}
