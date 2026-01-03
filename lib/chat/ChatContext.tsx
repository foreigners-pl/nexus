'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTotalUnreadCount } from '@/app/actions/chat'

interface BuzzNotification {
  id: string
  senderName: string
  conversationId: string
  timestamp: Date
}

interface ChatContextType {
  unreadCount: number
  refreshCount: () => Promise<void>
  latestSenderName: string | null
  activeBuzz: BuzzNotification | null
  dismissBuzz: () => void
  isMiniChatOpen: boolean
  setMiniChatOpen: (open: boolean) => void
  miniChatConversationId: string | null
  openMiniChat: (conversationId?: string | null) => void
  closeMiniChat: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

// Sound settings (shared with notification settings)
function getChatSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const saved = localStorage.getItem('notification-sound')
  return saved !== 'false'
}

function getChatSoundType(): string {
  if (typeof window === 'undefined') return 'bubble'
  return localStorage.getItem('notification-sound-type') || 'bubble'
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [latestSenderName, setLatestSenderName] = useState<string | null>(null)
  const [activeBuzz, setActiveBuzz] = useState<BuzzNotification | null>(null)
  const [isMiniChatOpen, setMiniChatOpen] = useState(false)
  const [miniChatConversationId, setMiniChatConversationId] = useState<string | null>(null)
  const supabase = createClient()
  const audioContextRef = useRef<AudioContext | null>(null)
  const userInteractedRef = useRef(false)
  const prevCountRef = useRef<number | null>(null)
  const originalTitle = useRef('Nexus CRM')
  const titleIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const buzzTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track user interaction for audio
  useEffect(() => {
    const enableAudio = () => {
      userInteractedRef.current = true
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume()
      }
    }
    document.addEventListener('click', enableAudio, { once: true })
    document.addEventListener('keydown', enableAudio, { once: true })
    return () => {
      document.removeEventListener('click', enableAudio)
      document.removeEventListener('keydown', enableAudio)
    }
  }, [])

  // Tab title flashing effect
  useEffect(() => {
    if (unreadCount > 0 && latestSenderName) {
      let showingSender = false
      titleIntervalRef.current = setInterval(() => {
        showingSender = !showingSender
        document.title = showingSender 
          ? `💬 ${latestSenderName}` 
          : `(${unreadCount}) Nexus CRM`
      }, 1500)
    } else {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current)
        titleIntervalRef.current = null
      }
      document.title = originalTitle.current
    }

    return () => {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current)
      }
    }
  }, [unreadCount, latestSenderName])

  // Play chat notification sound
  const playChatSound = useCallback(() => {
    if (!getChatSoundEnabled() || !userInteractedRef.current) return

    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioContextRef.current = new AudioContextClass()
      }

      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') return

      const now = ctx.currentTime
      const type = getChatSoundType()

      // Simple bubble sound for chat
      if (type === 'bubble' || type === 'gentle') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(400, now)
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1)
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.15)
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc.start(now)
        osc.stop(now + 0.25)
      } else if (type === 'ding') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now)
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
        osc.start(now)
        osc.stop(now + 0.4)
      } else {
        // Default chime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(523.25, now)
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
        osc.start(now)
        osc.stop(now + 0.5)
      }
    } catch {
      // Ignore errors
    }
  }, [])

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
    })
  }, [supabase])

  const refreshCount = useCallback(async () => {
    const { count } = await getTotalUnreadCount()
    setUnreadCount(count)
  }, [])

  const dismissBuzz = useCallback(() => {
    setActiveBuzz(null)
    if (buzzTimeoutRef.current) {
      clearTimeout(buzzTimeoutRef.current)
      buzzTimeoutRef.current = null
    }
  }, [])

  const openMiniChat = useCallback((conversationId?: string | null) => {
    setMiniChatConversationId(conversationId || null)
    setMiniChatOpen(true)
  }, [])

  const closeMiniChat = useCallback(() => {
    setMiniChatOpen(false)
    setMiniChatConversationId(null)
  }, [])

  // Initial load
  useEffect(() => {
    refreshCount()
  }, [refreshCount])

  // Subscribe to new messages for realtime updates
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('chat-unread-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          const newMessage = payload.new as { 
            id: string
            sender_id: string
            conversation_id: string
            content: string | null
            is_system?: boolean
            created_at: string
          }
          // Only handle if message is from someone else
          if (newMessage.sender_id && newMessage.sender_id !== userId) {
            // Get sender name for tab title
            const { data: sender } = await supabase
              .from('users')
              .select('display_name, email')
              .eq('id', newMessage.sender_id)
              .single()
            
            const senderName = sender?.display_name || sender?.email?.split('@')[0] || 'Someone'
            
            if (sender) {
              setLatestSenderName(senderName)
            }
            
            // Check if this is a buzz message
            if (newMessage.is_system && newMessage.content?.includes('sent a buzz')) {
              // Clear any existing timeout
              if (buzzTimeoutRef.current) {
                clearTimeout(buzzTimeoutRef.current)
              }
              
              // Set the active buzz
              setActiveBuzz({
                id: newMessage.id,
                senderName,
                conversationId: newMessage.conversation_id,
                timestamp: new Date(newMessage.created_at)
              })
              
              // Auto-dismiss after 10 seconds
              buzzTimeoutRef.current = setTimeout(() => {
                setActiveBuzz(null)
                buzzTimeoutRef.current = null
              }, 10000)
            }
            
            // Play sound and refresh count
            playChatSound()
            refreshCount()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // When last_read_at is updated (user read messages), refresh count
          refreshCount()
          // Clear the sender name when messages are read
          setLatestSenderName(null)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, refreshCount, playChatSound])

  return (
    <ChatContext.Provider value={{ 
      unreadCount, 
      refreshCount, 
      latestSenderName,
      activeBuzz,
      dismissBuzz,
      isMiniChatOpen,
      setMiniChatOpen,
      miniChatConversationId,
      openMiniChat,
      closeMiniChat
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
