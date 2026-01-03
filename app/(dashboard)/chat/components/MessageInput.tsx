'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { sendBuzz } from '@/app/actions/chat'
import EmojiPicker from './EmojiPicker'

interface MessageInputProps {
  onSend: (content: string, attachment?: { url: string; name: string; type: string }) => void
  disabled: boolean
  conversationId: string
}

// Max height for ~10 lines (10 * 24px line height approx)
const MAX_TEXTAREA_HEIGHT = 240

export default function MessageInput({ onSend, disabled, conversationId }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachment, setAttachment] = useState<{ url: string; name: string; type: string } | null>(null)
  const [showBuzzConfirm, setShowBuzzConfirm] = useState(false)
  const [buzzing, setBuzzing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ top: 0, left: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  // Click outside to close emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        showEmoji && 
        emojiPickerRef.current && !emojiPickerRef.current.contains(target) &&
        emojiButtonRef.current && !emojiButtonRef.current.contains(target)
      ) {
        setShowEmoji(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmoji])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    
    // Set new height, capped at MAX_TEXTAREA_HEIGHT
    const newHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)
    textarea.style.height = `${newHeight}px`
    
    // Show/hide overflow based on whether we've hit max height
    textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
  }, [message])

  const handleSend = () => {
    if ((!message.trim() && !attachment) || disabled) return
    
    onSend(message, attachment || undefined)
    setMessage('')
    setAttachment(null)
    setShowEmoji(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = conversationId + '/' + Date.now() + '.' + fileExt
      
      const { data, error } = await supabase.storage
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
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newMessage = message.substring(0, start) + emoji + message.substring(end)
    setMessage(newMessage)
    setShowEmoji(false)
    
    // Focus back to textarea
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  const removeAttachment = () => {
    setAttachment(null)
  }

  const handleBuzz = async () => {
    setBuzzing(true)
    const { success, error } = await sendBuzz(conversationId)
    if (!success) {
      console.error('Buzz error:', error)
    }
    setBuzzing(false)
    setShowBuzzConfirm(false)
  }

  return (
    <div className="border-t border-white/5 p-4 bg-[hsl(240_3%_11%)]/80 backdrop-blur-xl">
      {/* Attachment preview */}
      {attachment && (
        <div className="mb-3 p-3 bg-white/5 rounded-xl flex items-center gap-3 border border-white/10">
          {attachment.type.startsWith('image/') ? (
            <img src={attachment.url} alt={attachment.name} className="h-14 w-14 object-cover rounded-lg shadow-lg" />
          ) : (
            <div className="h-14 w-14 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
              <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
          <span className="flex-1 text-sm truncate text-white/80">{attachment.name}</span>
          <button onClick={removeAttachment} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white/50 hover:text-white/80 disabled:opacity-50 self-center"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="relative self-center">
          <button
            ref={emojiButtonRef}
            onClick={(e) => {
              if (showEmoji) {
                setShowEmoji(false)
              } else {
                const rect = e.currentTarget.getBoundingClientRect()
                setEmojiPickerPosition({
                  top: rect.top - 8,
                  left: rect.left
                })
                setShowEmoji(true)
              }
            }}
            className="p-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white/50 hover:text-white/80"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {mounted && showEmoji && createPortal(
            <div 
              ref={emojiPickerRef}
              style={{
                position: 'fixed',
                top: emojiPickerPosition.top,
                left: emojiPickerPosition.left,
                transform: 'translateY(-100%)',
                zIndex: 9999
              }}
            >
              <EmojiPicker onSelect={handleEmojiSelect} />
            </div>,
            document.body
          )}
        </div>

        {/* Buzz button */}
        <button
          onClick={() => setShowBuzzConfirm(true)}
          disabled={disabled}
          className="p-2.5 rounded-xl hover:bg-yellow-500/20 transition-all duration-200 text-yellow-500/70 hover:text-yellow-400 disabled:opacity-50 self-center"
          title="Send a buzz"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Message input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none placeholder:text-white/30 text-white transition-all duration-200 overflow-hidden scrollbar-thin"
            style={{ minHeight: '48px' }}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={(!message.trim() && !attachment) || disabled}
          className="p-3 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-105 active:scale-95 self-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      {/* Buzz Confirmation Modal */}
      {mounted && showBuzzConfirm && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[hsl(240_3%_15%)] border border-white/10 rounded-2xl shadow-2xl p-6 max-w-sm mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Send a Buzz? 🔔</h3>
            <p className="text-white/60 mb-6 text-sm">
              This will send a notification to everyone in this chat to get their attention!
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowBuzzConfirm(false)}
                disabled={buzzing}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBuzz}
                disabled={buzzing}
                className="px-5 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {buzzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Buzzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Buzz!
                  </>
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
