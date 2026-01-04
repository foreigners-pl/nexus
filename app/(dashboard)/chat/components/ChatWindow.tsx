'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { useMessagesCache } from '@/lib/query'
import { 
  ConversationWithDetails, 
  Message, 
  getMessages, 
  sendMessage, 
  markConversationRead,
  addReaction,
  removeReaction,
  startMeeting,
  endMeeting
} from '@/app/actions/chat'
import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'
import EmojiPicker from './EmojiPicker'

interface ChatWindowProps {
  conversation: ConversationWithDetails
  onBack: () => void
  onMeetingUpdate?: () => void
}

export default function ChatWindow({ conversation, onBack, onMeetingUpdate }: ChatWindowProps) {
  const { getCached: getCachedMessages, setCached: setCachedMessages } = useMessagesCache(conversation.id)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [activeMeeting, setActiveMeeting] = useState<string | null>(conversation.active_meeting_url)
  const [meetingStartedAt, setMeetingStartedAt] = useState<string | null>(conversation.meeting_started_at)
  const [meetingDuration, setMeetingDuration] = useState<string>('')
  const [startingMeeting, setStartingMeeting] = useState(false)
  const [showEndMeetingModal, setShowEndMeetingModal] = useState(false)
  const [endingMeeting, setEndingMeeting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [initialScrollDone, setInitialScrollDone] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null)
    })
  }, [supabase])

  // Meeting duration timer
  useEffect(() => {
    if (!meetingStartedAt) {
      setMeetingDuration('')
      return
    }

    const updateDuration = () => {
      const start = new Date(meetingStartedAt).getTime()
      const now = Date.now()
      const diff = now - start
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      if (hours > 0) {
        setMeetingDuration(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      } else {
        setMeetingDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }
    }

    updateDuration()
    const interval = setInterval(updateDuration, 1000)
    return () => clearInterval(interval)
  }, [meetingStartedAt])

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      setInitialScrollDone(false)
      
      // Try cache first for INSTANT display
      const cached = getCachedMessages()
      if (cached?.messages && cached.messages.length > 0) {
        console.log('[ChatWindow] Using cached messages:', cached.messages.length)
        setMessages(cached.messages)
        setHasMore(cached.hasMore || false)
        setLoading(false)
        
        // Mark as read
        markConversationRead(conversation.id)
        
        // Still refresh in background
        getMessages(conversation.id, 20).then(({ messages: freshMessages, hasMore: more }) => {
          setMessages(freshMessages)
          setHasMore(more)
          setCachedMessages({ messages: freshMessages, hasMore: more })
        })
        return
      }
      
      setLoading(true)
      const { messages: loadedMessages, hasMore: more } = await getMessages(conversation.id, 20)
      setMessages(loadedMessages)
      setHasMore(more)
      setCachedMessages({ messages: loadedMessages, hasMore: more })
      setLoading(false)
      
      // Mark as read
      await markConversationRead(conversation.id)
    }
    loadMessages()
  }, [conversation.id])

  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDone) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      setInitialScrollDone(true)
    }
  }, [loading, messages.length, initialScrollDone])

  // Scroll to bottom when new message is added (not when loading older)
  useEffect(() => {
    if (initialScrollDone && !loadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // Load older messages when scrolling up
  const handleScroll = useCallback(async () => {
    const container = messagesContainerRef.current
    if (!container || loadingMore || !hasMore) return

    // Load more when scrolled near top (within 100px)
    if (container.scrollTop < 100) {
      const oldestMessage = messages[0]
      if (!oldestMessage) return

      setLoadingMore(true)
      const prevScrollHeight = container.scrollHeight

      const { messages: olderMessages, hasMore: more } = await getMessages(
        conversation.id, 
        10, 
        oldestMessage.created_at
      )

      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev])
        setHasMore(more)

        // Maintain scroll position after prepending messages
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight
          container.scrollTop = newScrollHeight - prevScrollHeight
        })
      }

      setLoadingMore(false)
    }
  }, [conversation.id, messages, loadingMore, hasMore])

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        async (payload) => {
          const newMessage = payload.new as Message
          
          // Just use the message from payload - sender info will be looked up by MessageBubble
          setMessages(prev => {
            // Avoid duplicates if we already added it optimistically
            if (prev.some(m => m.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })
          // Mark as read if we're viewing this conversation
          await markConversationRead(conversation.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        async () => {
          // Reload current messages to get updated reactions (keep same count)
          const { messages: reloadedMessages } = await getMessages(conversation.id, Math.max(messages.length, 10))
          setMessages(reloadedMessages)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversation.id}`
        },
        async (payload) => {
          // Update meeting status when conversation changes
          const updated = payload.new as { active_meeting_url: string | null; meeting_started_at: string | null }
          setActiveMeeting(updated.active_meeting_url)
          setMeetingStartedAt(updated.meeting_started_at)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, conversation.id])

  const handleSendMessage = async (content: string, attachment?: { url: string; name: string; type: string }) => {
    if (!content.trim() && !attachment) return

    setSending(true)
    const { error } = await sendMessage(conversation.id, content, attachment)
    
    if (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message: ' + error)
    }
    // Don't add message here - let the realtime subscription handle it to avoid duplicates
    setSending(false)
  }

  const handleAddReaction = async (messageId: string, emoji: string) => {
    await addReaction(messageId, emoji)
    setShowEmojiPicker(null)
  }

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    await removeReaction(messageId, emoji)
  }

  const handleStartMeeting = async () => {
    setStartingMeeting(true)
    
    // Generate a deterministic meeting URL based on conversation ID
    // Using Jitsi Meet - free, no login required, same link = same room
    const roomName = `nexus-${conversation.id.slice(0, 8)}`
    const meetingUrl = `https://meet.jit.si/${roomName}`
    
    const { success, error } = await startMeeting(conversation.id, meetingUrl)
    
    if (success) {
      setActiveMeeting(meetingUrl)
      setMeetingStartedAt(new Date().toISOString())
      // Open the meeting in a new tab
      window.open(meetingUrl, '_blank')
      onMeetingUpdate?.()
    } else {
      alert('Failed to start meeting: ' + error)
    }
    
    setStartingMeeting(false)
  }

  const handleEndMeeting = async () => {
    setEndingMeeting(true)
    const { success, error } = await endMeeting(conversation.id)
    if (success) {
      setActiveMeeting(null)
      setMeetingStartedAt(null)
      onMeetingUpdate?.()  
    } else {
      alert('Failed to end meeting: ' + error)
    }
    setEndingMeeting(false)
    setShowEndMeetingModal(false)
  }

  const getConversationName = () => {
    if (conversation.is_group && conversation.name) {
      return conversation.name
    }
    const otherMember = conversation.members?.find(m => m.user_id !== currentUserId)
    if (otherMember?.users) {
      return otherMember.users.display_name || otherMember.users.email.split('@')[0]
    }
    return 'Unknown'
  }

  const getConversationSubtitle = () => {
    if (conversation.is_group) {
      const count = conversation.members?.length || 0
      return `${count} member${count !== 1 ? 's' : ''}`
    }
    const otherMember = conversation.members?.find(m => m.user_id !== currentUserId)
    return otherMember?.users?.email || ''
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-[hsl(240_3%_11%)]/80 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/10 transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold shadow-lg ${
          conversation.is_group 
            ? 'bg-gradient-to-br from-purple-500/30 to-purple-600/20 text-purple-400 border border-purple-500/20' 
            : 'bg-gradient-to-br from-primary/30 to-primary/10 text-primary border border-primary/20'
        }`}>
          {conversation.is_group ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ) : (
            getConversationName().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate text-white">{getConversationName()}</h2>
          <p className="text-sm text-white/50 truncate">{getConversationSubtitle()}</p>
        </div>

        {/* Meeting button */}
        {activeMeeting ? (
          <div className="flex items-center gap-2">
            <a
              href={activeMeeting}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
              title="Join active meeting"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm font-medium text-green-400">Join Meeting</span>
              {meetingDuration && (
                <span className="text-xs text-green-400/70 font-mono">{meetingDuration}</span>
              )}
            </a>
            <button
              onClick={() => setShowEndMeetingModal(true)}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all duration-200 text-red-400 hover:text-red-300"
              title="End meeting"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartMeeting}
            disabled={startingMeeting}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
            title="Start Video Call"
          >
            {startingMeeting ? (
              <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin"
        onClick={() => setShowEmojiPicker(null)}
        onScroll={handleScroll}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p>No messages yet</p>
              <p className="text-sm mt-1">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Loading older messages indicator */}
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              </div>
            )}
            {hasMore && !loadingMore && (
              <div className="text-center text-white/30 text-xs py-2">
                Scroll up to load older messages
              </div>
            )}
            {messages.map((message, index) => {
              const prevMessage = messages[index - 1]
              const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id
              const isOwnMessage = message.sender_id === currentUserId

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={isOwnMessage}
                  showAvatar={showAvatar}
                  currentUserId={currentUserId}
                  members={conversation.members}
                  onReactionClick={(messageId) => setShowEmojiPicker(showEmojiPicker === messageId ? null : messageId)}
                  onAddReaction={handleAddReaction}
                  onRemoveReaction={handleRemoveReaction}
                  showEmojiPicker={showEmojiPicker === message.id}
                  activeMeeting={activeMeeting}
                  meetingStartedAt={meetingStartedAt}
                />
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        onSend={handleSendMessage}
        disabled={sending}
        conversationId={conversation.id}
      />

      {/* End Meeting Confirmation Modal */}
      {mounted && showEndMeetingModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !endingMeeting && setShowEndMeetingModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-[#1c1c1e] border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
            {/* Icon */}
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </div>
            
            {/* Title */}
            <h3 className="text-lg font-semibold text-white text-center mb-2">
              End Meeting?
            </h3>
            
            {/* Description */}
            <p className="text-sm text-white/60 text-center mb-6">
              This will end the meeting for everyone in this conversation.
            </p>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndMeetingModal(false)}
                disabled={endingMeeting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEndMeeting}
                disabled={endingMeeting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {endingMeeting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    Ending...
                  </>
                ) : (
                  'End Meeting'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
