'use client'

import { use } from 'react'
import { AssistantSessionView } from '@/components/mobile/AssistantSessions'

export default function AssistantSessionPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params)
  return <AssistantSessionView date={date} />
}
