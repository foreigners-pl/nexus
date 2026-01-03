'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Input } from './Input'

interface SelectOption {
  id: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled = false
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [mounted, setMounted] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  const selectedOption = options.find(opt => opt.id === value)
  
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Also check if click is inside the portal dropdown
        const dropdown = document.getElementById('select-dropdown-portal')
        if (dropdown && dropdown.contains(event.target as Node)) {
          return
        }
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (optionId: string) => {
    onChange(optionId)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          if (disabled) return
          if (isOpen) {
            setIsOpen(false)
          } else {
            const rect = e.currentTarget.getBoundingClientRect()
            setDropdownPosition({
              top: rect.bottom + window.scrollY + 8,
              left: rect.left + window.scrollX,
              width: rect.width
            })
            setIsOpen(true)
          }
        }}
        className="w-full px-4 py-2.5 text-left bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] rounded-xl hover:border-[hsl(var(--color-border-hover))] hover:bg-[hsl(var(--color-surface-hover))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))/0.3] focus:border-[hsl(var(--color-primary))] disabled:opacity-50 disabled:cursor-not-allowed text-[hsl(var(--color-text-primary))] transition-all duration-200 flex items-center justify-between"
      >
        <span className={selectedOption ? 'text-[hsl(var(--color-text-primary))]' : 'text-[hsl(var(--color-text-muted))]'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className={`w-4 h-4 text-[hsl(var(--color-text-muted))] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {mounted && isOpen && createPortal(
        <div 
          id="select-dropdown-portal"
          style={{
            position: 'absolute',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
          className="z-[9999] bg-[hsl(var(--color-surface))] backdrop-blur-xl border border-[hsl(var(--color-border))] rounded-xl shadow-[0_10px_40px_rgb(0_0_0/0.4)] max-h-60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="p-2 border-b border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-hover)/0.3)]">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="bg-[hsl(var(--color-surface))]"
            />
          </div>
          <div className="overflow-y-auto max-h-48 p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))] text-center">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full px-4 py-2.5 text-left text-sm rounded-lg transition-all duration-150 ${
                    option.id === value 
                      ? 'bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-primary))] font-medium' 
                      : 'text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-hover))]'
                  }`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
