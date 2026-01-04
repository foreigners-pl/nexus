'use client'

import { useState, useEffect } from 'react'
import { useConversationsCache, useDeepPrefetchChat } from '@/lib/query'
import { getConversations, ConversationWithDetails } from '@/app/actions/chat'
import ChatContainer from './components/ChatContainer'

export default function ChatPage() {
  const { getCached } = useConversationsCache()
  const deepPrefetchChat = useDeepPrefetchChat()
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try cache first for instant load
    const cached = getCached()
    if (cached?.conversations && cached.conversations.length > 0) {
      setConversations(cached.conversations)
      setLoading(false)
      // Deep prefetch: Load messages for ALL conversations in background
      deepPrefetchChat()
      // Still refresh conversations list in background
      getConversations().then(({ conversations: fresh }) => {
        if (fresh) setConversations(fresh)
      })
    } else {
      // No cache, load fresh
      getConversations().then(({ conversations: fresh }) => {
        setConversations(fresh || [])
        setLoading(false)
        // Deep prefetch after initial load
        setTimeout(() => deepPrefetchChat(), 100)
      })
    }
  }, [getCached, deepPrefetchChat])

  if (loading) {
    // Show skeleton UI instead of spinner
    return (
      <div className="h-[calc(100vh-4rem+3rem)] -mx-6 -my-6 flex">
        {/* Conversations list skeleton */}
        <div className="w-80 border-r border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))] p-4">
          <div className="h-10 bg-[hsl(var(--color-surface-hover))] rounded-lg animate-pulse mb-4" />
          <div className="space-y-3">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--color-surface-hover))] animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-[hsl(var(--color-surface-hover))] rounded animate-pulse" />
                  <div className="h-3 w-32 bg-[hsl(var(--color-surface-hover))] rounded animate-pulse mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Chat area skeleton */}
        <div className="flex-1 flex items-center justify-center bg-[hsl(var(--color-background))]">
          <p className="text-[hsl(var(--color-text-secondary))]">Select a conversation</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-[calc(100vh-4rem+3rem)] -mx-6 -my-6">
      <ChatContainer initialConversations={conversations} />
    </div>
  )
}
