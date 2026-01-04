'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { ConversationWithDetails, Message, getConversations } from '@/app/actions/chat'
import { useConversationsCache } from '@/lib/query'
import ConversationList from './ConversationList'
import ChatWindow from './ChatWindow'
import NewChatModal from './NewChatModal'

interface ChatContainerProps {
  initialConversations: ConversationWithDetails[]
}

export default function ChatContainer({ initialConversations }: ChatContainerProps) {
  const { setCached: setCachedConversations } = useConversationsCache()
  const [conversations, setConversations] = useState<ConversationWithDetails[]>(initialConversations)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [isMobileListVisible, setIsMobileListVisible] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  
  // Use ref to track if we've already handled the URL param
  const urlParamHandled = useRef(false)
  // Use ref to access current selectedConversationId in realtime callback without re-subscribing
  const selectedConversationIdRef = useRef<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Keep ref in sync
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId
  }, [selectedConversationId])

  // Cache conversations whenever they change
  useEffect(() => {
    setCachedConversations({ conversations })
  }, [conversations, setCachedConversations])

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null)
    })
  }, [supabase])

  // Handle conversation query param ONCE on mount or when URL changes
  useEffect(() => {
    const conversationId = searchParams.get('conversation')
    if (conversationId && !urlParamHandled.current) {
      // Check if conversation exists in initial list
      const exists = initialConversations.some(c => c.id === conversationId)
      if (exists) {
        urlParamHandled.current = true
        setSelectedConversationId(conversationId)
        setIsMobileListVisible(false)
        // Clear unread count for selected conversation
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
          )
        )
      }
    }
  }, [searchParams, initialConversations])

  // Subscribe to realtime updates - only depends on currentUserId
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel('chat-updates')
      // Listen for new messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          const newMessage = payload.new as Message
          
          setConversations(prev => {
            const existingConv = prev.find(c => c.id === newMessage.conversation_id)
            
            if (existingConv) {
              // Update existing conversation
              const updated = prev.map(conv => {
                if (conv.id === newMessage.conversation_id) {
                  return {
                    ...conv,
                    last_message: newMessage,
                    updated_at: newMessage.created_at,
                    // Use ref to check current selection without re-subscribing
                    unread_count: conv.id === selectedConversationIdRef.current 
                      ? conv.unread_count 
                      : (conv.unread_count || 0) + 1
                  }
                }
                return conv
              })
              return updated.sort((a, b) => 
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
              )
            }
            return prev
          })
          
          // If conversation not in list, refresh
          setConversations(prev => {
            const exists = prev.some(c => c.id === newMessage.conversation_id)
            if (!exists) {
              // Trigger refresh outside of setState
              getConversations().then(({ conversations: refreshed }) => {
                if (refreshed) setConversations(refreshed)
              })
            }
            return prev
          })
        }
      )
      // Listen for when we're added to a new conversation
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${currentUserId}`
        },
        async () => {
          // Someone added us to a conversation - refresh the list
          const { conversations: refreshed } = await getConversations()
          if (refreshed) setConversations(refreshed)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, currentUserId])

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id)
    setIsMobileListVisible(false)
    
    // Clear unread count for selected conversation
    setConversations(prev => 
      prev.map(conv => 
        conv.id === id ? { ...conv, unread_count: 0 } : conv
      )
    )
  }

  const handleNewConversation = (conversation: ConversationWithDetails) => {
    // Add new conversation to list if not exists
    setConversations(prev => {
      const exists = prev.some(c => c.id === conversation.id)
      if (exists) return prev
      return [conversation, ...prev]
    })
    setSelectedConversationId(conversation.id)
    setShowNewChatModal(false)
    setIsMobileListVisible(false)
  }

  const handleBackToList = () => {
    setIsMobileListVisible(true)
  }

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id))
    if (selectedConversationId === id) {
      setSelectedConversationId(null)
      setIsMobileListVisible(true)
    }
  }

  const selectedConversation = conversations.find(c => c.id === selectedConversationId)

  return (
    <div className="flex h-full bg-[hsl(240_3%_11%)] overflow-hidden">
      {/* Conversation List - hidden on mobile when chat is open */}
      <div className={`${isMobileListVisible ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 lg:w-96 border-r border-white/5`}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          onNewChat={() => setShowNewChatModal(true)}
          onDelete={handleDeleteConversation}
        />
      </div>

      {/* Chat Window */}
      <div className={`${!isMobileListVisible ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 bg-[hsl(240_3%_9%)]`}>
        {selectedConversation ? (
          <ChatWindow 
            conversation={selectedConversation}
            onBack={handleBackToList}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                <svg className="w-10 h-10 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-white/80">Select a conversation</p>
              <p className="text-sm mt-2 text-white/40">or start a new chat</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onCreated={handleNewConversation}
      />
    </div>
  )
}
