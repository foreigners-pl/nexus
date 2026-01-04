'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { 
  ConversationWithDetails, 
  Message, 
  getConversations, 
  getMessages, 
  sendMessage, 
  markConversationRead,
  addReaction,
  removeReaction,
  sendBuzz
} from '@/app/actions/chat'
import { useChat } from '@/lib/chat/ChatContext'
import EmojiPicker from './EmojiPicker'

// Frequently used reaction emojis
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [initialScrollDone, setInitialScrollDone] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [attachment, setAttachment] = useState<{ url: string; name: string; type: string } | null>(null)
  const [showBuzzConfirm, setShowBuzzConfirm] = useState(false)
  const [buzzing, setBuzzing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ top: 0, left: 0 })
  const [reactionPickerPosition, setReactionPickerPosition] = useState({ top: 0, left: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const reactionPickerRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDone && selectedConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      setInitialScrollDone(true)
    }
  }, [loading, messages.length, initialScrollDone, selectedConversation])

  // Scroll to bottom when new message is added
  useEffect(() => {
    if (initialScrollDone && !loadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // Load older messages when scrolling up
  const handleScroll = useCallback(async () => {
    const container = messagesContainerRef.current
    if (!container || loadingMore || !hasMore || !selectedConversation) return

    if (container.scrollTop < 50) {
      const oldestMessage = messages[0]
      if (!oldestMessage) return

      setLoadingMore(true)
      const prevScrollHeight = container.scrollHeight

      const { messages: olderMessages, hasMore: more } = await getMessages(
        selectedConversation.id, 
        10, 
        oldestMessage.created_at
      )

      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev])
        setHasMore(more)

        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight
          container.scrollTop = newScrollHeight - prevScrollHeight
        })
      }

      setLoadingMore(false)
    }
  }, [selectedConversation, messages, loadingMore, hasMore])

  // Click outside to close emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        showEmojiPicker && 
        emojiPickerRef.current && !emojiPickerRef.current.contains(target) &&
        emojiButtonRef.current && !emojiButtonRef.current.contains(target)
      ) {
        setShowEmojiPicker(false)
      }
      if (
        showReactionPicker &&
        reactionPickerRef.current && !reactionPickerRef.current.contains(target)
      ) {
        setShowReactionPicker(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker, showReactionPicker])

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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        async () => {
          // Refresh messages to get updated reactions (keep same count)
          const { messages: refreshed } = await getMessages(selectedConversation.id, Math.max(messages.length, 10))
          setMessages(refreshed)
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
    setInitialScrollDone(false)
    const { messages: loaded, hasMore: more } = await getMessages(conv.id)
    setMessages(loaded)
    setHasMore(more)
    await markConversationRead(conv.id)
    setLoading(false)
  }

  const handleSend = async () => {
    if ((!messageText.trim() && !attachment) || !selectedConversation || sending) return

    setSending(true)
    const text = messageText
    setMessageText('')

    await sendMessage(selectedConversation.id, text, attachment || undefined)
    setAttachment(null)

    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedConversation) return

    setUploading(true)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = selectedConversation.id + '/' + Date.now() + '.' + fileExt
      
      const { error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName)

      setAttachment({
        url: publicUrl,
        name: file.name,
        type: file.type
      })
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setMessageText(prev => prev + emoji)
    setShowEmojiPicker(false)
  }

  const handleAddReaction = async (messageId: string, emoji: string) => {
    await addReaction(messageId, emoji)
    setShowReactionPicker(null)
  }

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    await removeReaction(messageId, emoji)
  }

  const handleBuzz = async () => {
    if (!selectedConversation) return
    setBuzzing(true)
    await sendBuzz(selectedConversation.id)
    setBuzzing(false)
    setShowBuzzConfirm(false)
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

  // Message bubble with reactions
  const MessageBubble = ({ message }: { message: Message }) => {
    const isOwn = message.sender_id === currentUserId
    const reactionGroups = message.reactions?.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = { count: 0, userIds: [] }
      }
      acc[reaction.emoji].count++
      acc[reaction.emoji].userIds.push(reaction.user_id)
      return acc
    }, {} as Record<string, { count: number; userIds: string[] }>) || {}

    if (message.is_system) {
      return (
        <div className="text-center text-xs text-white/40 py-1 w-full">
          {message.content}
        </div>
      )
    }

    return (
      <div className={`flex group ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="relative max-w-[80%]">
          <div
            className={`px-3 py-2 rounded-xl text-sm ${
              isOwn
                ? 'bg-[#0A84FF] text-white rounded-br-md'
                : 'bg-white/10 text-white/90 rounded-bl-md'
            }`}
          >
            {!isOwn && (
              <div className="text-xs text-white/50 mb-0.5">
                {message.sender?.display_name || message.sender?.email?.split('@')[0]}
              </div>
            )}
            {message.content && (
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            )}
            {message.attachment_url && (
              <div className="mt-1.5">
                {message.attachment_type?.startsWith('image/') ? (
                  <img 
                    src={message.attachment_url} 
                    alt={message.attachment_name || 'Image'} 
                    className="max-w-full rounded-lg max-h-40 object-cover"
                  />
                ) : (
                  <a 
                    href={message.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-2 py-1.5 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="truncate max-w-[120px]">{message.attachment_name}</span>
                  </a>
                )}
              </div>
            )}
            <div className={`text-[10px] mt-1 ${isOwn ? 'text-white/60' : 'text-white/40'}`}>
              {formatTime(message.created_at)}
            </div>
          </div>

          {/* Reaction button */}
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setReactionPickerPosition({
                top: rect.top - 50,
                left: isOwn ? rect.left - 160 : rect.right + 8
              })
              setShowReactionPicker(showReactionPicker === message.id ? null : message.id)
            }}
            className={`absolute top-1/2 -translate-y-1/2 p-1 rounded-full bg-[hsl(240_3%_15%)] border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity ${
              isOwn ? '-left-7' : '-right-7'
            }`}
          >
            <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Reactions display */}
          {Object.keys(reactionGroups).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(reactionGroups).map(([emoji, { count, userIds }]) => {
                const hasReacted = currentUserId && userIds.includes(currentUserId)
                return (
                  <button
                    key={emoji}
                    onClick={() => hasReacted 
                      ? handleRemoveReaction(message.id, emoji)
                      : handleAddReaction(message.id, emoji)
                    }
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors ${
                      hasReacted 
                        ? 'bg-primary/20 border border-primary/40' 
                        : 'bg-white/10 border border-white/10 hover:bg-white/15'
                    }`}
                  >
                    <span>{emoji}</span>
                    {count > 1 && <span className="text-white/50">{count}</span>}
                  </button>
                )
              })}
            </div>
          )}
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
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin"
              onScroll={handleScroll}
            >
              {/* Loading older messages indicator */}
              {loadingMore && (
                <div className="flex justify-center py-1">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {hasMore && !loadingMore && (
                <div className="text-center text-white/30 text-[10px] py-1">
                  Scroll up for older messages
                </div>
              )}
              {messages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Attachment preview */}
            {attachment && (
              <div className="mx-3 mb-2 p-2 bg-white/5 rounded-lg flex items-center gap-2 border border-white/10">
                {attachment.type.startsWith('image/') ? (
                  <img src={attachment.url} alt={attachment.name} className="h-10 w-10 object-cover rounded" />
                ) : (
                  <div className="h-10 w-10 bg-white/5 rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                <span className="flex-1 text-xs truncate text-white/80">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="p-1 hover:bg-white/10 rounded">
                  <svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Input */}
            <div className="p-2 border-t border-white/10">
              <div className="flex items-center gap-1">
                {/* Attachment button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white/80 disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                />

                {/* Emoji button */}
                <button
                  ref={emojiButtonRef}
                  onClick={(e) => {
                    if (showEmojiPicker) {
                      setShowEmojiPicker(false)
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setEmojiPickerPosition({
                        top: rect.top - 8,
                        left: rect.left
                      })
                      setShowEmojiPicker(true)
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {/* Buzz button */}
                <button
                  onClick={() => setShowBuzzConfirm(true)}
                  className="p-2 rounded-lg hover:bg-yellow-500/20 transition-colors text-yellow-500/70 hover:text-yellow-400"
                  title="Send a buzz"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>

                {/* Input */}
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-white/30"
                />

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={(!messageText.trim() && !attachment) || sending}
                  className="p-2 bg-primary hover:bg-primary/90 disabled:bg-white/10 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Conversation List */
          <div className="flex-1 overflow-y-auto scrollbar-thin">
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

      {/* Emoji Picker Portal */}
      {mounted && showEmojiPicker && createPortal(
        <div 
          ref={emojiPickerRef}
          style={{
            position: 'fixed',
            top: emojiPickerPosition.top,
            left: emojiPickerPosition.left,
            transform: 'translateY(-100%)',
            zIndex: 10002
          }}
        >
          <EmojiPicker onSelect={handleEmojiSelect} />
        </div>,
        document.body
      )}

      {/* Reaction Picker Portal */}
      {mounted && showReactionPicker && createPortal(
        <div 
          ref={reactionPickerRef}
          style={{
            position: 'fixed',
            top: reactionPickerPosition.top,
            left: reactionPickerPosition.left,
            zIndex: 10002
          }}
          className="bg-[hsl(240_3%_15%)] border border-white/10 rounded-xl shadow-xl p-2 flex gap-1"
        >
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleAddReaction(showReactionPicker, emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-lg transition-colors hover:scale-110"
            >
              {emoji}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Buzz Confirmation Modal */}
      {mounted && showBuzzConfirm && createPortal(
        <div className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[hsl(240_3%_15%)] border border-white/10 rounded-2xl shadow-2xl p-5 max-w-xs mx-4 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">Send a Buzz? 🔔</h3>
            <p className="text-white/60 mb-4 text-xs">
              This will notify everyone in this chat!
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setShowBuzzConfirm(false)}
                disabled={buzzing}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBuzz}
                disabled={buzzing}
                className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {buzzing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Buzzing...
                  </>
                ) : (
                  'Buzz!'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
