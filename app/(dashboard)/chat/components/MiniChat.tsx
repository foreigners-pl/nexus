'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { 
  ConversationWithDetails, 
  Message, 
  getConversations, 
  getMessages, 
  sendMessage, 
  markConversationRead 
} from '@/app/actions/chat'
import { useChat } from '@/lib/chat/ChatContext'

export default function MiniChat() {
  const { 
    isMiniChatOpen, 
    closeMiniChat, 
    miniChatConversationId, 
    openMiniChat,
    activeBuzz,
    dismissBuzz
  } = useChat()
  
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  // Load conversations when mini chat opens
  useEffect(() => {
    if (isMiniChatOpen) {
      loadConversations()
    }
  }, [isMiniChatOpen])

  // Select conversation if provided
  useEffect(() => {
    if (miniChatConversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === miniChatConversationId)
      if (conv) {
        selectConversation(conv)
      }
    }
  }, [miniChatConversationId, conversations])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Subscribe to new messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation) return

    const channel = supabase
      .channel(`mini-chat-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        async (payload) => {
          const newMessage = payload.new as Message
          // Get sender info
          if (newMessage.sender_id) {
            const { data: sender } = await supabase
              .from('users')
              .select('id, display_name, email')
              .eq('id', newMessage.sender_id)
              .single()
            if (sender) {
              newMessage.sender = sender
            }
          }
          setMessages(prev => [...prev, newMessage])
          markConversationRead(selectedConversation.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConversation, supabase])

  const loadConversations = async () => {
    setLoading(true)
    const { conversations: loaded } = await getConversations()
    setConversations(loaded)
    setLoading(false)
  }

  const selectConversation = async (conv: ConversationWithDetails) => {
    setSelectedConversation(conv)
    setLoading(true)
    const { messages: loaded } = await getMessages(conv.id)
    setMessages(loaded)
    await markConversationRead(conv.id)
    setLoading(false)
  }

  const handleSend = async () => {
    if (!messageText.trim() || !selectedConversation || sending) return

    setSending(true)
    const text = messageText
    setMessageText('')

    await sendMessage(selectedConversation.id, text)

    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getConversationName = (conv: ConversationWithDetails): string => {
    if (conv.name) return conv.name
    if (!conv.is_group && conv.members) {
      const otherMember = conv.members.find(m => m.user_id !== currentUserId)
      return otherMember?.users?.display_name || otherMember?.users?.email?.split('@')[0] || 'Unknown'
    }
    return 'Group Chat'
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  // Buzz notification popup
  const BuzzNotification = () => {
    if (!activeBuzz) return null

    return (
      <div className="fixed bottom-24 right-4 z-[10001] animate-bounce">
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-3 rounded-xl shadow-lg border border-yellow-400/50 flex items-center gap-3">
          <div className="text-2xl">🔔</div>
          <div className="flex-1">
            <div className="font-semibold">{activeBuzz.senderName} buzzed you!</div>
            <div className="text-sm text-white/80">{formatTime(activeBuzz.timestamp.toISOString())}</div>
          </div>
          <button
            onClick={() => {
              openMiniChat(activeBuzz.conversationId)
              dismissBuzz()
            }}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            Reply
          </button>
          <button
            onClick={dismissBuzz}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  if (!isMiniChatOpen) {
    return (
      <>
        <BuzzNotification />
        <button
          onClick={() => openMiniChat()}
          className="fixed bottom-4 right-4 z-[10000] w-14 h-14 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      </>
    )
  }

  return (
    <>
      <BuzzNotification />
      <div className="fixed bottom-4 right-4 z-[10000] w-[360px] h-[500px] bg-[hsl(240_5%_12%)] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[hsl(240_5%_15%)]">
          {selectedConversation ? (
            <>
              <button
                onClick={() => setSelectedConversation(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-medium text-white/90 flex-1 text-center truncate px-2">
                {getConversationName(selectedConversation)}
              </span>
            </>
          ) : (
            <span className="font-medium text-white/90">Messages</span>
          )}
          <button
            onClick={closeMiniChat}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : selectedConversation ? (
          /* Chat View */
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                >
                  {message.is_system ? (
                    <div className="text-center text-xs text-white/40 py-1 w-full">
                      {message.content}
                    </div>
                  ) : (
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                        message.sender_id === currentUserId
                          ? 'bg-primary text-white rounded-br-md'
                          : 'bg-white/10 text-white/90 rounded-bl-md'
                      }`}
                    >
                      {message.sender_id !== currentUserId && (
                        <div className="text-xs text-white/50 mb-0.5">
                          {message.sender?.display_name || message.sender?.email?.split('@')[0]}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                      <div className={`text-[10px] mt-1 ${message.sender_id === currentUserId ? 'text-white/60' : 'text-white/40'}`}>
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-white/30"
                />
                <button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sending}
                  className="p-2 bg-primary hover:bg-primary/90 disabled:bg-white/10 disabled:cursor-not-allowed rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Conversation List */
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-white/40">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className="w-full p-3 hover:bg-white/5 border-b border-white/5 flex items-center gap-3 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-white/70 font-medium">
                    {getConversationName(conv).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white/90 truncate">
                      {getConversationName(conv)}
                    </div>
                    {conv.last_message && (
                      <div className="text-xs text-white/40 truncate">
                        {conv.last_message.content}
                      </div>
                    )}
                  </div>
                  {conv.unread_count && conv.unread_count > 0 && (
                    <div className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}
