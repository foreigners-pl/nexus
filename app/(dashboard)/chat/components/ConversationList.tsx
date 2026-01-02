'use client'

import { useState, useEffect } from 'react'
import { ConversationWithDetails } from '@/app/actions/chat'
import { createBrowserClient } from '@supabase/ssr'

interface ConversationListProps {
  conversations: ConversationWithDetails[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
}

export default function ConversationList({ 
  conversations, 
  selectedId, 
  onSelect, 
  onNewChat 
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null)
    })
  }, [supabase])

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true
    const name = getConversationName(conv, currentUserId)
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full bg-[hsl(240_3%_11%)]">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Chat</h1>
          <button
            onClick={onNewChat}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 hover:scale-105 active:scale-95"
            title="New conversation"
          >
            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-white/30 transition-all duration-200"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="py-2">
            {filteredConversations.map(conv => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedId}
                currentUserId={currentUserId}
                onClick={() => onSelect(conv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface ConversationItemProps {
  conversation: ConversationWithDetails
  isSelected: boolean
  currentUserId: string | null
  onClick: () => void
}

function ConversationItem({ conversation, isSelected, currentUserId, onClick }: ConversationItemProps) {
  const name = getConversationName(conversation, currentUserId)
  const lastMessage = conversation.last_message
  const unreadCount = conversation.unread_count || 0

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      // Use consistent 24h format to avoid hydration mismatch
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return hours + ':' + minutes
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return weekdays[date.getDay()]
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return months[date.getMonth()] + ' ' + date.getDate()
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-3 mx-2 my-0.5 flex items-start gap-3 rounded-xl transition-all duration-200 text-left ${
        isSelected 
          ? 'bg-white/10 shadow-lg shadow-black/10' 
          : 'hover:bg-white/5'
      }`}
      style={{ width: 'calc(100% - 16px)' }}
    >
      {/* Avatar */}
      <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold shadow-lg ${
        conversation.is_group 
          ? 'bg-gradient-to-br from-purple-500/30 to-purple-600/20 text-purple-400 border border-purple-500/20' 
          : 'bg-gradient-to-br from-primary/30 to-primary/10 text-primary border border-primary/20'
      }`}>
        {conversation.is_group ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ) : (
          getInitials(name)
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium truncate ${unreadCount > 0 ? 'text-white' : 'text-white/90'}`}>
            {name}
          </span>
          {lastMessage && (
            <span className="text-xs text-white/40 flex-shrink-0 font-medium">
              {formatTime(lastMessage.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className={`text-sm truncate ${unreadCount > 0 ? 'text-white/80 font-medium' : 'text-white/50'}`}>
            {lastMessage ? (
              lastMessage.is_system ? (
                <span className="italic">
                  {(() => {
                    const senderMember = conversation.members?.find(m => m.user_id === lastMessage.sender_id)
                    const senderName = senderMember?.users?.display_name || senderMember?.users?.email?.split('@')[0] || lastMessage.sender?.display_name || 'Someone'
                    return `${senderName} ${lastMessage.content}`
                  })()}
                </span>
              ) : (
                lastMessage.content || (lastMessage.attachment_name ? '📎 Attachment' : '')
              )
            ) : (
              'No messages yet'
            )}
          </span>
          {unreadCount > 0 && (
            <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 shadow-lg shadow-primary/30">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function getConversationName(conversation: ConversationWithDetails, currentUserId: string | null): string {
  if (conversation.is_group && conversation.name) {
    return conversation.name
  }
  
  // For DMs, show the other person's name
  const otherMember = conversation.members?.find(m => m.user_id !== currentUserId)
  if (otherMember?.users) {
    return otherMember.users.display_name || otherMember.users.email.split('@')[0]
  }
  
  return 'Unknown'
}
