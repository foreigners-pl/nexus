'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { ConversationWithDetails, Message, getConversations } from '@/app/actions/chat'
import ConversationList from './ConversationList'
import ChatWindow from './ChatWindow'
import NewChatModal from './NewChatModal'

interface ChatContainerProps {
  initialConversations: ConversationWithDetails[]
}

export default function ChatContainer({ initialConversations }: ChatContainerProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>(initialConversations)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [isMobileListVisible, setIsMobileListVisible] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null)
    })
  }, [supabase])

  // Subscribe to realtime updates
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
          
          // Check if this conversation is in our list
          const existingConv = conversations.find(c => c.id === newMessage.conversation_id)
          
          if (existingConv) {
            // Update existing conversation
            setConversations(prev => {
              const updated = prev.map(conv => {
                if (conv.id === newMessage.conversation_id) {
                  return {
                    ...conv,
                    last_message: newMessage,
                    updated_at: newMessage.created_at,
                    unread_count: conv.id === selectedConversationId 
                      ? conv.unread_count 
                      : (conv.unread_count || 0) + 1
                  }
                }
                return conv
              })
              return updated.sort((a, b) => 
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
              )
            })
          } else {
            // New conversation we weren't aware of - refresh the list
            const { conversations: refreshed } = await getConversations()
            setConversations(refreshed)
          }
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
          setConversations(refreshed)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, currentUserId, selectedConversationId, conversations])

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
