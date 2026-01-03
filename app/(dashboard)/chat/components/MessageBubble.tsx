'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Message, ConversationMember } from '@/app/actions/chat'
import EmojiPicker from './EmojiPicker'

interface MessageBubbleProps {
  message: Message
  isOwnMessage: boolean
  showAvatar: boolean
  currentUserId: string | null
  members: ConversationMember[]
  onReactionClick: (messageId: string) => void
  onAddReaction: (messageId: string, emoji: string) => void
  onRemoveReaction: (messageId: string, emoji: string) => void
  showEmojiPicker: boolean
  activeMeeting?: string | null
  meetingStartedAt?: string | null
}

export default function MessageBubble({
  message,
  isOwnMessage,
  showAvatar,
  currentUserId,
  members,
  onReactionClick,
  onAddReaction,
  onRemoveReaction,
  showEmojiPicker,
  activeMeeting,
  meetingStartedAt
}: MessageBubbleProps) {
  const [mounted, setMounted] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 })
  const reactionBtnRef = useRef<HTMLButtonElement>(null)

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate picker position when button is clicked (before parent updates showEmojiPicker)
  const handleReactionClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (reactionBtnRef.current) {
      const rect = reactionBtnRef.current.getBoundingClientRect()
      const pickerWidth = 288 // w-72 = 18rem = 288px
      
      // Position picker below the button, aligned based on message side
      if (isOwnMessage) {
        setPickerPosition({
          top: rect.bottom + 8,
          left: rect.right - pickerWidth
        })
      } else {
        setPickerPosition({
          top: rect.bottom + 8,
          left: rect.left
        })
      }
    }
    onReactionClick(message.id)
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Get sender info from members list or fallback to message.sender
  const senderMember = members?.find(m => m.user_id === message.sender_id)
  const senderName = senderMember?.users?.display_name || senderMember?.users?.email?.split('@')[0] || message.sender?.display_name || message.sender?.email?.split('@')[0] || 'Unknown'

  // System message for meetings
  if (message.is_system) {
    const isMeetingStart = message.content?.includes('started a meeting')
    const isMeetingEnd = message.content?.includes('ended the meeting')
    
    if (isMeetingStart) {
      return (
        <div className="flex justify-center my-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-400 font-medium">{senderName} started a meeting</p>
              <p className="text-xs text-white/40 mt-0.5">{formatTime(message.created_at)}</p>
            </div>
            {activeMeeting && meetingStartedAt && (() => {
              // Only show Join on the message that started the current meeting
              const messageTime = new Date(message.created_at).getTime()
              const meetingTime = new Date(meetingStartedAt).getTime()
              const isCurrentMeetingMessage = Math.abs(messageTime - meetingTime) < 5000 // Within 5 seconds
              
              return isCurrentMeetingMessage ? (
                <a
                  href={activeMeeting}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 transition-all text-green-400 text-sm font-medium"
                >
                  Join
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : null
            })()}
          </div>
        </div>
      )
    }
    
    if (isMeetingEnd) {
      return (
        <div className="flex justify-center my-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm text-white/60">{senderName} ended the meeting</p>
              <p className="text-xs text-white/40 mt-0.5">{formatTime(message.created_at)}</p>
            </div>
          </div>
        </div>
      )
    }
    
    // Default system message
    return (
      <div className="flex justify-center my-4">
        <span className="text-xs text-white/40 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
          {senderName} {message.content}
        </span>
      </div>
    )
  }

  const reactionGroups = message.reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = { count: 0, userIds: [] }
    }
    acc[reaction.emoji].count++
    acc[reaction.emoji].userIds.push(reaction.user_id)
    return acc
  }, {} as Record<string, { count: number; userIds: string[] }>) || {}

  // Apple-style message bubbles - iMessage blue for own, gray for others
  const bubbleClasses = isOwnMessage 
    ? 'bg-[#0A84FF] text-white rounded-3xl rounded-br-lg shadow-lg shadow-blue-500/20' 
    : 'bg-white/10 text-white rounded-3xl rounded-bl-lg shadow-lg shadow-black/10'
  
  const attachmentClasses = isOwnMessage 
    ? 'bg-white/20' 
    : 'bg-white/5'
  
  const timeClasses = isOwnMessage 
    ? 'text-white/70' 
    : 'text-white/40'
  
  const reactionBtnClasses = isOwnMessage ? '-left-10' : '-right-10'
  const pickerClasses = isOwnMessage ? 'right-0' : 'left-0'

  return (
    <div className={'flex gap-3 group ' + (isOwnMessage ? 'justify-end' : 'justify-start')}>
      {!isOwnMessage && (
        <div className="w-9 flex-shrink-0">
          {showAvatar && (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-primary flex items-center justify-center text-xs font-semibold border border-primary/20 shadow-lg">
              {getInitials(senderName)}
            </div>
          )}
        </div>
      )}

      <div className={'flex flex-col max-w-[70%] ' + (isOwnMessage ? 'items-end' : 'items-start')}>
        {showAvatar && !isOwnMessage && (
          <span className="text-xs text-white/50 mb-1.5 ml-1 font-medium">{senderName}</span>
        )}

        <div className="relative">
          <div className={'relative px-4 py-2.5 ' + bubbleClasses}>
            {message.content && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            )}

            {message.attachment_url && (
              <div className="mt-2">
                {message.attachment_type?.startsWith('image/') ? (
                  <img 
                    src={message.attachment_url} 
                    alt={message.attachment_name || 'Image'} 
                    className="max-w-full rounded-2xl max-h-60 object-cover shadow-lg"
                  />
                ) : (
                  <a 
                    href={message.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={'flex items-center gap-2 p-2.5 rounded-xl transition-all duration-200 hover:scale-[1.02] ' + attachmentClasses}
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm truncate">{message.attachment_name}</span>
                  </a>
                )}
              </div>
            )}

            <span className={'text-[10px] mt-1.5 block font-medium ' + timeClasses}>
              {formatTime(message.created_at)}
            </span>
          </div>

          <button
            ref={reactionBtnRef}
            onClick={handleReactionClick}
            className={'absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-[hsl(240_3%_15%)] border border-white/10 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-[hsl(240_3%_20%)] ' + reactionBtnClasses}
          >
            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {mounted && showEmojiPicker && createPortal(
            <div 
              style={{
                position: 'fixed',
                top: pickerPosition.top,
                left: Math.max(8, Math.min(pickerPosition.left, window.innerWidth - 296)),
                zIndex: 9999
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <EmojiPicker onSelect={(emoji) => onAddReaction(message.id, emoji)} />
            </div>,
            document.body
          )}
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Object.entries(reactionGroups).map(([emoji, { count, userIds }]) => {
              const hasReacted = currentUserId && userIds.includes(currentUserId)
              const reactionClass = hasReacted 
                ? 'bg-primary/20 border border-primary/40 shadow-lg shadow-primary/10' 
                : 'bg-white/10 border border-white/10 hover:bg-white/15'
              return (
                <button
                  key={emoji}
                  onClick={() => hasReacted 
                    ? onRemoveReaction(message.id, emoji)
                    : onAddReaction(message.id, emoji)
                  }
                  className={'flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all duration-200 hover:scale-105 active:scale-95 ' + reactionClass}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="text-xs text-white/50 font-medium">{count}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
