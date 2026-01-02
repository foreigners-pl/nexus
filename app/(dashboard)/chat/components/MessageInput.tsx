'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Click outside to close emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmoji && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
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
        <div className="relative self-center" ref={emojiPickerRef}>
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white/50 hover:text-white/80"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {showEmoji && (
            <div className="absolute bottom-full left-0 mb-2 z-50">
              <EmojiPicker onSelect={handleEmojiSelect} />
            </div>
          )}
        </div>

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
    </div>
  )
}
