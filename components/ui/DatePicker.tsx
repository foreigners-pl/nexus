'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: string
  onChange: (date: string) => void
  onBlur?: () => void
  className?: string
}

export function DatePicker({ value, onChange, onBlur, className }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? new Date(value) : null
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (value) {
      setSelectedDate(new Date(value))
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Also check if click is inside the portal dropdown
        const dropdown = document.getElementById('datepicker-dropdown-portal')
        if (dropdown && dropdown.contains(event.target as Node)) {
          return
        }
        setIsOpen(false)
        onBlur?.()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onBlur])

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX
      })
    }
  }, [isOpen])

  const formatDate = (date: Date | null) => {
    if (!date) return ''
    return date.toISOString().split('T')[0]
  }

  const formatDisplayDate = (date: Date | null) => {
    if (!date) return 'dd/mm/yyyy'
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    onChange(formatDate(date))
    setIsOpen(false)
    onBlur?.()
  }

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const currentMonth = selectedDate?.getMonth() ?? new Date().getMonth()
  const currentYear = selectedDate?.getFullYear() ?? new Date().getFullYear()

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-8" />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day)
    const isSelected = selectedDate && 
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()

    days.push(
      <button
        key={day}
        onClick={() => handleDateSelect(date)}
        className={cn(
          'h-8 w-8 rounded text-sm hover:bg-[hsl(var(--color-hover))] transition-colors',
          isSelected && 'bg-[hsl(var(--color-primary))] text-white hover:bg-[hsl(var(--color-primary))]'
        )}
      >
        {day}
      </button>
    )
  }

  const handlePrevMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1)
    setSelectedDate(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1)
    setSelectedDate(newDate)
  }

  const handleToday = () => {
    const today = new Date()
    setSelectedDate(today)
    onChange(formatDate(today))
    setIsOpen(false)
    onBlur?.()
  }

  const handleClear = () => {
    setSelectedDate(null)
    onChange('')
    setIsOpen(false)
    onBlur?.()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2',
          'bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))]',
          'text-[hsl(var(--color-text-primary))] text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-input-focus))]',
          'transition-colors duration-[var(--transition-base)]',
          className
        )}
      >
        <span className={!selectedDate ? 'text-[hsl(var(--color-text-muted))]' : ''}>
          {formatDisplayDate(selectedDate)}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </button>

      {mounted && isOpen && createPortal(
        <div 
          id="datepicker-dropdown-portal"
          style={{
            position: 'absolute',
            top: dropdownPosition.top,
            left: dropdownPosition.left
          }}
          className="z-[9999] rounded-[var(--radius-md)] border border-[hsl(var(--color-border))] bg-[hsl(var(--color-bg))] p-3 shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="h-8 w-8 rounded hover:bg-[hsl(var(--color-hover))] transition-colors"
            >
              
            </button>
            <div className="font-medium text-sm">
              {monthNames[currentMonth]} {currentYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="h-8 w-8 rounded hover:bg-[hsl(var(--color-hover))] transition-colors"
            >
              
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
              <div key={day} className="h-8 w-8 flex items-center justify-center text-xs text-[hsl(var(--color-text-secondary))]">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 mb-3">
            {days}
          </div>

          <div className="flex gap-2 pt-2 border-t border-[hsl(var(--color-border))]">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 h-8 rounded text-xs hover:bg-[hsl(var(--color-hover))] transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="flex-1 h-8 rounded text-xs hover:bg-[hsl(var(--color-hover))] transition-colors"
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
