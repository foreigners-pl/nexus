'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { updateUserProfile } from '@/app/actions/users'
import { toggleActivityPreference } from '@/app/actions/settings'
import { 
  ACTIVITY_TYPES, 
  CATEGORY_INFO,
  ENTITY_INFO,
  getActivitiesByEntity,
  type ActivityType,
  type ActivityPreferences,
  type EntityType,
  type CategoryType,
  DEFAULT_FEED
} from '@/lib/activity-types'
import { User } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { useNotifications, SOUND_TYPES, type SoundType } from '@/lib/notifications/NotificationContext'

interface SettingsContentProps {
  initialProfile: User | null
  initialPreferences: ActivityPreferences | null
}

export function SettingsContent({ initialProfile, initialPreferences }: SettingsContentProps) {
  // Notification context
  const { soundEnabled, setSoundEnabled, soundType, setSoundType, testSound } = useNotifications()
  
  // Profile state
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? '')
  const [contactNumber, setContactNumber] = useState(initialProfile?.contact_number ?? '')
  const [saving, setSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Password state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Activity preferences state - use defaults if empty or null
  // Always use defaults for new users or when preferences are empty
  const computeInitialFeed = (): ActivityType[] => {
    // If no preferences exist, use defaults
    if (!initialPreferences) return [...DEFAULT_FEED]
    
    // If show_in_feed is not a valid array, use defaults
    const feed = initialPreferences.show_in_feed
    if (!feed || !Array.isArray(feed) || feed.length === 0) {
      return [...DEFAULT_FEED]
    }
    
    // Validate and return
    return feed as ActivityType[]
  }

  const [feedPreferences, setFeedPreferences] = useState<ActivityType[]>(() => computeInitialFeed())
  const [savingActivity, setSavingActivity] = useState<string | null>(null)

  const handleSaveProfile = async () => {
    setSaving(true)
    setProfileMessage(null)
    
    const result = await updateUserProfile({
      display_name: displayName,
      contact_number: contactNumber
    })

    if (result.error) {
      setProfileMessage({ type: 'error', text: result.error })
    } else {
      setProfileMessage({ type: 'success', text: 'Profile saved!' })
      setTimeout(() => setProfileMessage(null), 3000)
    }
    
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (!oldPassword) {
      setPasswordMessage({ type: 'error', text: 'Please enter your current password' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }

    setSavingPassword(true)
    setPasswordMessage(null)
    
    const supabase = createClient()
    
    // First verify old password by re-authenticating
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      setPasswordMessage({ type: 'error', text: 'Unable to verify user' })
      setSavingPassword(false)
      return
    }
    
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword
    })
    
    if (signInError) {
      setPasswordMessage({ type: 'error', text: 'Current password is incorrect' })
      setSavingPassword(false)
      return
    }
    
    // Now update to new password
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPasswordMessage({ type: 'error', text: error.message })
    } else {
      setPasswordMessage({ type: 'success', text: 'Password updated!' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMessage(null), 3000)
    }
    
    setSavingPassword(false)
  }

  const handleToggleFeed = async (activityType: ActivityType) => {
    const enabled = !feedPreferences.includes(activityType)
    setSavingActivity(`feed-${activityType}`)
    
    if (enabled) {
      setFeedPreferences(prev => [...prev, activityType])
    } else {
      setFeedPreferences(prev => prev.filter(t => t !== activityType))
    }

    const result = await toggleActivityPreference(activityType, 'show_in_feed', enabled)
    
    if (result.error) {
      if (enabled) {
        setFeedPreferences(prev => prev.filter(t => t !== activityType))
      } else {
        setFeedPreferences(prev => [...prev, activityType])
      }
    }
    
    setSavingActivity(null)
  }

  // Toggle component
  const Toggle = ({ checked, onChange, disabled, label }: { 
    checked: boolean
    onChange: () => void
    disabled?: boolean
    label: string
  }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`
        relative w-11 h-6 rounded-full transition-all duration-200 cursor-pointer shrink-0 flex items-center
        ${checked 
          ? 'bg-[hsl(var(--color-primary))]' 
          : 'bg-[hsl(var(--color-surface-active))] border border-[hsl(var(--color-border))]'
        }
        ${disabled ? 'opacity-50' : ''}
      `}
      aria-label={label}
    >
      <span 
        className={`
          w-[18px] h-[18px] rounded-full transition-all duration-200 shadow-sm
          ${checked 
            ? 'translate-x-[22px] bg-white' 
            : 'translate-x-[3px] bg-[hsl(var(--color-text-muted))]'
          }
        `}
      />
    </button>
  )

  const entityColors: Record<EntityType, string> = {
    cases: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    tasks: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  }
  
  const entityIconColors: Record<EntityType, string> = {
    cases: 'text-blue-400',
    tasks: 'text-purple-400',
  }

  const categoryColors: Record<CategoryType, string> = {
    assignments: 'text-blue-400',
    updates: 'text-purple-400',
    payments: 'text-green-400',
    reminders: 'text-orange-400',
  }

  // Render entity section (header + categories)
  const renderEntitySection = (entity: EntityType, isComingSoon = false) => {
    const activities = getActivitiesByEntity(entity)
    const categories = Object.keys(activities) as CategoryType[]

    return (
      <div className={isComingSoon ? 'opacity-50' : ''}>
        {/* Entity Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[hsl(var(--color-border))]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${entityColors[entity]} flex items-center justify-center`}>
              {entity === 'cases' && (
                <svg className={`w-5 h-5 ${entityIconColors[entity]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
              {entity === 'tasks' && (
                <svg className={`w-5 h-5 ${entityIconColors[entity]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              )}
            </div>
            <span className={`text-lg font-semibold ${entityIconColors[entity]}`}>
              {ENTITY_INFO[entity].label}
            </span>
            {isComingSoon && (
              <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-muted))]">
                Soon
              </span>
            )}
          </div>
          {/* Column header */}
          <span className="text-xs font-semibold text-[hsl(var(--color-text-secondary))] uppercase tracking-wide">Off/On</span>
        </div>

        {/* Categories and Activities */}
        <div className="space-y-5">
          {categories.map(category => (
            <div key={category}>
              <div className={`text-sm font-semibold uppercase tracking-wider mb-2.5 ${categoryColors[category]}`}>
                {CATEGORY_INFO[category].label}
              </div>
              <div className="space-y-0.5">
                {activities[category]?.map(({ id, label }) => (
                  <div 
                    key={id}
                    className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-[hsl(var(--color-surface-hover))] transition-colors group cursor-default"
                  >
                    <span className="flex-1 text-[15px] text-[hsl(var(--color-text-primary))] group-hover:text-white transition-colors">
                      {label}
                    </span>
                    <Toggle
                      checked={feedPreferences.includes(id)}
                      onChange={() => !isComingSoon && handleToggleFeed(id)}
                      disabled={isComingSoon || savingActivity === `feed-${id}`}
                      label={`${label} notifications`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile & Security Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">Profile</h3>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">Your personal information</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <Input
                label="Email"
                value={initialProfile?.email ?? ''}
                disabled
                className="opacity-60"
              />
              <Input
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
              />
              <Input
                label="Contact Number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="Enter your contact number"
              />
              
              {profileMessage && (
                <div className={`text-sm px-3 py-2 rounded-lg ${
                  profileMessage.type === 'success' 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {profileMessage.text}
                </div>
              )}
              
              <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Password Settings */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">Security</h3>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">Update your password</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              
              {passwordMessage && (
                <div className={`text-sm px-3 py-2 rounded-lg ${
                  passwordMessage.type === 'success' 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {passwordMessage.text}
                </div>
              )}
              
              <Button 
                onClick={handleChangePassword} 
                disabled={savingPassword || !oldPassword || !newPassword || !confirmPassword}
                variant="secondary"
                className="w-full"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Sound Settings */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">Notification Sound</h3>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">Play a sound when new notifications arrive</p>
              </div>
            </div>
            <Toggle
              checked={soundEnabled}
              onChange={() => setSoundEnabled(!soundEnabled)}
              label="Notification sound"
            />
          </div>
          
          {soundEnabled && (
            <div className="flex items-center gap-3 pt-3 border-t border-[hsl(var(--color-border))]">
              <span className="text-sm text-[hsl(var(--color-text-secondary))]">Sound:</span>
              <div className="flex gap-2 flex-wrap flex-1">
                {(Object.keys(SOUND_TYPES) as SoundType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSoundType(type)
                      // Auto-play when selecting
                      setTimeout(testSound, 50)
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      soundType === type
                        ? 'bg-[hsl(var(--color-primary))] text-white'
                        : 'bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-active))]'
                    }`}
                  >
                    {SOUND_TYPES[type]}
                  </button>
                ))}
              </div>
              <button
                onClick={testSound}
                className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-active))] transition-colors"
              >
                Test
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Activity Notifications Section */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">Notifications</h3>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">Choose what shows in feed and triggers emails</p>
            </div>
          </div>

          {/* 2 Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Left Column - Cases */}
            <div className="md:pr-6 md:border-r md:border-[hsl(var(--color-border))]">
              {renderEntitySection('cases')}
            </div>
            
            {/* Right Column - Tasks */}
            <div className="md:pl-2">
              {renderEntitySection('tasks')}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
