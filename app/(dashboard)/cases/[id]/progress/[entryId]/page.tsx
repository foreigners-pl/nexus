'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

// Old per-entry pages are retired — everything lives in the step feed now.
// Deep links (notifications, request rows) land on the entry's step.
export default function EntryPage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = use(params)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const go = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('case_entries')
        .select('step_id')
        .eq('id', entryId)
        .maybeSingle()
      if (cancelled) return
      router.replace(data?.step_id ? `/cases/${id}/progress?s=${data.step_id}` : `/cases/${id}/progress`)
    }
    go()
    return () => { cancelled = true }
  }, [id, entryId, router])

  return (
    <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  )
}
