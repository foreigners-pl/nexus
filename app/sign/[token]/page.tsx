import { getSigningPageData } from '@/app/actions/agreements'
import { SigningFlow } from './SigningFlow'

interface SignPageProps {
  params: Promise<{ token: string }>
}

export default async function SignPage({ params }: SignPageProps) {
  const { token } = await params
  const data = await getSigningPageData(token)

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[hsl(var(--color-text-primary))]">Link not found</h1>
          <p className="text-sm text-[hsl(var(--color-text-secondary))] mt-2">
            This agreement link is invalid or has expired. Please contact Foreigners.pl for a new one.
          </p>
        </div>
      </div>
    )
  }

  return <SigningFlow token={token} data={data} />
}
