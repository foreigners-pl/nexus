'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NotificationContextType {
  unreadCount: number
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  soundType: string
  setSoundType: (type: string) => void
  refreshCount: () => Promise<void>
  testSound: () => void
}

export const SOUND_TYPES = {
  bubble: 'Bubble',
  chime: 'Chime', 
  ding: 'Ding',
  drop: 'Drop',
  gentle: 'Gentle',
} as const

export type SoundType = keyof typeof SOUND_TYPES

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [soundEnabled, setSoundEnabledState] = useState(true)
  const [soundType, setSoundTypeState] = useState<SoundType>('bubble')
  const [userId, setUserId] = useState<string | null>(null)
  const prevCountRef = useRef<number | null>(null) // null = not initialized yet
  const audioContextRef = useRef<AudioContext | null>(null)
  const userInteractedRef = useRef(false)

  // Track user interaction to enable audio
  useEffect(() => {
    const enableAudio = () => {
      userInteractedRef.current = true
      // Resume audio context if it was created in suspended state
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

  // Load sound preferences from localStorage
  useEffect(() => {
    const savedEnabled = localStorage.getItem('notification-sound')
    if (savedEnabled !== null) {
      setSoundEnabledState(savedEnabled === 'true')
    }
    const savedType = localStorage.getItem('notification-sound-type')
    if (savedType && savedType in SOUND_TYPES) {
      setSoundTypeState(savedType as SoundType)
    }
  }, [])

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled)
    localStorage.setItem('notification-sound', String(enabled))
  }

  const setSoundType = (type: string) => {
    if (type in SOUND_TYPES) {
      setSoundTypeState(type as SoundType)
      localStorage.setItem('notification-sound-type', type)
    }
  }

  // Different sound generators
  const playSound = useCallback((ctx: AudioContext, type: SoundType) => {
    const now = ctx.currentTime
    
    switch (type) {
      case 'bubble': {
        // Bubble pop - rising pitch with soft pop
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
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.1)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        
        osc.start(now)
        osc.stop(now + 0.25)
        break
      }
      
      case 'chime': {
        // Bell chime - two harmonics
        const freqs = [523.25, 659.25] // C5, E5 - major third
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now)
          
          const vol = i === 0 ? 0.1 : 0.05
          gain.gain.setValueAtTime(0.001, now)
          gain.gain.exponentialRampToValueAtTime(vol, now + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
          
          osc.start(now)
          osc.stop(now + 0.6)
        })
        break
      }
      
      case 'ding': {
        // Simple ding - single clean tone
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now) // A5
        
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
        
        osc.start(now)
        osc.stop(now + 0.4)
        break
      }
      
      case 'drop': {
        // Water drop - descending pitch
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1200, now)
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15)
        
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
        
        osc.start(now)
        osc.stop(now + 0.3)
        break
      }
      
      case 'gentle': {
        // Very soft, low hum
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const filter = ctx.createBiquadFilter()
        
        osc.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)
        
        osc.type = 'sine'
        osc.frequency.setValueAtTime(330, now) // E4 - lower note
        
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(500, now)
        
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.1)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
        
        osc.start(now)
        osc.stop(now + 0.8)
        break
      }
    }
  }, [])

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled || !userInteractedRef.current) return
    
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioContextRef.current = new AudioContextClass()
      }
      
      const audioContext = audioContextRef.current
      if (audioContext.state === 'suspended') return
      
      playSound(audioContext, soundType)
    } catch {
      // Ignore errors
    }
  }, [soundEnabled, soundType, playSound])

  const refreshCount = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return
    
    const { count } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    
    const newCount = count || 0
    
    // Play sound if count increased (but not on initial load)
    if (prevCountRef.current !== null && newCount > prevCountRef.current) {
      playNotificationSound()
    }
    
    prevCountRef.current = newCount
    setUnreadCount(newCount)
  }, [playNotificationSound])

  // Get initial user and count
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        refreshCount()
      }
    }
    init()
  }, [refreshCount])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    
    const channel = supabase
      .channel('notification-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_log',
          filter: `user_id=eq.${userId}`
        },
        () => {
          refreshCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refreshCount])

  // Update browser tab title
  useEffect(() => {
    const baseTitle = 'Nexus CRM'
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`
    } else {
      document.title = baseTitle
    }
  }, [unreadCount])

  // Update PWA badge (if supported)
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        (navigator as Navigator & { setAppBadge: (count: number) => Promise<void> }).setAppBadge(unreadCount)
      } else {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge()
      }
    }
  }, [unreadCount])

  // Test sound function (always plays, ignores userInteracted check)
  const testSound = useCallback(() => {
    if (!soundEnabled) return
    
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioContextRef.current = new AudioContextClass()
      }
      
      const audioContext = audioContextRef.current
      
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }
      
      playSound(audioContext, soundType)
      userInteractedRef.current = true
    } catch {
      // Ignore errors
    }
  }, [soundEnabled, soundType, playSound])

  return (
    <NotificationContext.Provider value={{ unreadCount, soundEnabled, setSoundEnabled, soundType, setSoundType, refreshCount, testSound }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}