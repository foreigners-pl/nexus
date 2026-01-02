'use client'

import { useState, useEffect } from 'react'
import { 
  ConversationWithDetails, 
  getAllUsers, 
  createDirectConversation, 
  createGroupConversation 
} from '@/app/actions/chat'
import { Modal } from '@/components/ui/Modal'

interface User {
  id: string
  display_name: string | null
  email: string
}

interface NewChatModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (conversation: ConversationWithDetails) => void
}

export default function NewChatModal({ isOpen, onClose, onCreated }: NewChatModalProps) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  const loadUsers = async () => {
    setLoading(true)
    const { users: loadedUsers } = await getAllUsers()
    setUsers(loadedUsers)
    setLoading(false)
  }

  const handleClose = () => {
    setMode('direct')
    setSearchQuery('')
    setSelectedUsers([])
    setGroupName('')
    setError('')
    onClose()
  }

  const handleUserClick = async (userId: string) => {
    if (mode === 'direct') {
      // Start direct conversation immediately
      setCreating(true)
      const { conversation, error: err } = await createDirectConversation(userId)
      if (err) {
        setError(err)
        setCreating(false)
        return
      }
      if (conversation) {
        // Get the full conversation with members
        const selectedUser = users.find(u => u.id === userId)
        const fullConv: ConversationWithDetails = {
          ...conversation,
          members: selectedUser ? [{ 
            id: '', 
            conversation_id: conversation.id, 
            user_id: userId, 
            joined_at: '', 
            last_read_at: '', 
            is_admin: false,
            users: selectedUser 
          }] : [],
          unread_count: 0
        }
        onCreated(fullConv)
        handleClose()
      }
      setCreating(false)
    } else {
      // Toggle selection for group
      setSelectedUsers(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      )
    }
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('Please enter a group name')
      return
    }
    if (selectedUsers.length < 1) {
      setError('Please select at least one member')
      return
    }

    setCreating(true)
    const { conversation, error: err } = await createGroupConversation(groupName, selectedUsers)
    if (err) {
      setError(err)
      setCreating(false)
      return
    }
    if (conversation) {
      const fullConv: ConversationWithDetails = {
        ...conversation,
        members: selectedUsers.map(id => {
          const user = users.find(u => u.id === id)
          return {
            id: '',
            conversation_id: conversation.id,
            user_id: id,
            joined_at: '',
            last_read_at: '',
            is_admin: false,
            users: user
          }
        }),
        unread_count: 0
      }
      onCreated(fullConv)
      handleClose()
    }
    setCreating(false)
  }

  const filteredUsers = users.filter(user => {
    const name = user.display_name || user.email
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Conversation">
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
          <button
            onClick={() => {
              setMode('direct')
              setSelectedUsers([])
            }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'direct' 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Direct Message
          </button>
          <button
            onClick={() => setMode('group')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'group' 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Group Chat
          </button>
        </div>

        {/* Group name input */}
        {mode === 'group' && (
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-white/30 transition-all duration-200"
          />
        )}

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-white/30 transition-all duration-200"
          />
        </div>

        {/* Selected users for group */}
        {mode === 'group' && selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map(userId => {
              const user = users.find(u => u.id === userId)
              if (!user) return null
              return (
                <span 
                  key={userId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary rounded-full text-sm font-medium border border-primary/20"
                >
                  {user.display_name || user.email.split('@')[0]}
                  <button 
                    onClick={() => setSelectedUsers(prev => prev.filter(id => id !== userId))}
                    className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* User list */}
        <div className="max-h-64 overflow-y-auto border border-white/10 rounded-xl bg-white/5 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              No users found
            </div>
          ) : (
            filteredUsers.map(user => {
              const name = user.display_name || user.email.split('@')[0]
              const isSelected = selectedUsers.includes(user.id)
              return (
                <button
                  key={user.id}
                  onClick={() => handleUserClick(user.id)}
                  disabled={creating}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-all duration-200 text-left ${
                    isSelected ? 'bg-primary/10' : ''
                  } disabled:opacity-50`}
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-primary flex items-center justify-center text-sm font-semibold border border-primary/20 shadow-lg">
                    {getInitials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-white">{name}</p>
                    <p className="text-sm text-white/50 truncate">{user.email}</p>
                  </div>
                  {mode === 'group' && (
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                      isSelected 
                        ? 'bg-primary border-primary shadow-lg shadow-primary/20' 
                        : 'border-white/20'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Create group button */}
        {mode === 'group' && (
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleClose}
              disabled={creating}
              className="px-5 py-2.5 text-sm font-medium rounded-xl hover:bg-white/10 transition-all duration-200 disabled:opacity-50 text-white/70"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={creating || selectedUsers.length === 0 || !groupName.trim()}
              className="px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
