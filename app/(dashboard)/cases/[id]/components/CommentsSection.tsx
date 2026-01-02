'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { addComment } from '@/app/actions/comments'
import type { Comment } from '@/types/database'

interface CommentsSectionProps {
  caseId: string
  comments: Comment[]
  onUpdate: () => void
  currentUserId?: string
}

export function CommentsSection({ caseId, comments, onUpdate, currentUserId }: CommentsSectionProps) {
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmitting(true)
    setError(null)
    const result = await addComment(caseId, newComment.trim())
    
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }
    
    setNewComment('')
    onUpdate()
    setSubmitting(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getUserName = (comment: Comment) => {
    return comment.users?.display_name || comment.users?.email || 'Unknown User'
  }

  return (
    <>
      <div className="space-y-4">
        {/* Add Comment Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full px-3 py-2 bg-[hsl(var(--color-surface-hover))]/50 border border-[hsl(var(--color-border))] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-border-hover))] text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))]"
            rows={3}
            disabled={submitting}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !newComment.trim()}>
              {submitting ? 'Adding...' : 'Add Comment'}
            </Button>
          </div>
        </form>

        {/* Comments List */}
        <div className="max-h-[300px] overflow-y-auto pr-2">
          <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-8">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="border border-[hsl(var(--color-border))] rounded-xl p-3 space-y-2 bg-[hsl(var(--color-surface-hover))]/30 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        {getUserName(comment)}
                      </p>
                      <p className="text-xs text-[hsl(var(--color-text-muted))]">
                        {formatDate(comment.created_at)}
                      </p>
                    </div>
                    <p className="text-sm text-[hsl(var(--color-text-primary))] mt-1 whitespace-pre-wrap break-words">
                      {comment.text}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      </div>
    </>
  )
}
