'use client'

import { useState, useRef, useEffect } from 'react'
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
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.id === value)
  
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] rounded-md hover:border-[hsl(var(--color-input-focus))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-[hsl(var(--color-text-primary))]"
      >
        <span className={selectedOption ? 'text-[hsl(var(--color-text-primary))]' : 'text-[hsl(var(--color-text-muted))]'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-[hsl(var(--color-border))]">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[hsl(var(--color-text-secondary))]">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] ${
                    option.id === value ? 'bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--color-text-primary))]'
                  }`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
