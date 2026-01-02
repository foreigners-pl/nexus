import { getCurrentUserProfile } from '@/app/actions/users'
import { getActivityPreferences } from '@/app/actions/settings'
import { SettingsContent } from './components/SettingsContent'
import { PageHeader } from '@/components/shared/PageHeader'

export default async function SettingsPage() {
  const [profileResult, preferencesResult] = await Promise.all([
    getCurrentUserProfile(),
    getActivityPreferences()
  ])

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Settings"
        subtitle="Manage your account and application preferences"
        icon={
          <svg className="w-6 h-6 text-[hsl(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />

      <SettingsContent 
        initialProfile={profileResult.data ?? null}
        initialPreferences={preferencesResult.data ?? null}
      />
    </div>
  )
}
