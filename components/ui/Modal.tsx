'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  // Only render portal on client
  useEffect(() => {
    setMounted(true)
  }, [])

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={`
          bg-[hsl(var(--color-surface))] 
          rounded-2xl 
          border border-[hsl(var(--color-border))] 
          shadow-[0_25px_50px_-12px_rgb(0_0_0/0.5),0_0_0_1px_rgb(255_255_255/0.05)_inset]
          w-full ${maxWidthClasses[maxWidth]} mx-4 
          animate-in fade-in zoom-in duration-200
          overflow-hidden
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-hover)/0.3)] rounded-t-2xl">
          <h2 className="text-xl font-semibold text-[hsl(var(--color-text-primary))]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-hover))] transition-all duration-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
