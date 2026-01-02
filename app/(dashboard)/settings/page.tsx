import { getCurrentUserProfile } from '@/app/actions/users'
import { getActivityPreferences } from '@/app/actions/settings'
import { SettingsContent } from './components/SettingsContent'

export default async function SettingsPage() {
  const [profileResult, preferencesResult] = await Promise.all([
    getCurrentUserProfile(),
    getActivityPreferences()
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[hsl(var(--color-text-primary))]">
          Settings
        </h1>
        <p className="text-[hsl(var(--color-text-secondary))] mt-2">
          Manage your account and application preferences
        </p>
      </div>

      <SettingsContent 
        initialProfile={profileResult.data ?? null}
        initialPreferences={preferencesResult.data ?? null}
      />
    </div>
  )
}
