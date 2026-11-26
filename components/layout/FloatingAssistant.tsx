'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useNotifications } from '@/lib/notifications/NotificationContext'
import { Sparkles } from 'lucide-react'

const SIZE = 52
const MARGIN = 12
const DRAG_THRESHOLD = 8

// Messenger-style floating assistant head — mobile only. Sits above the
// bottom nav, draggable anywhere; shows the newest notification as a
// transient bubble, tap opens the assistant.
export function FloatingAssistant() {
  const { unreadCount, latest } = useNotifications()
  const router = useRouter()
  const pathname = usePathname()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [bubble, setBubble] = useState<{ text: string; link: string | null } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ sx: number; sy: number; moved: boolean } | null>(null)

  // Transient message next to the head — shows the newest alert for a few
  // seconds, then fades. Tapping it opens whatever the alert links to.
  useEffect(() => {
    if (!latest) return
    setBubble({ text: latest.body || latest.title, link: latest.link })
    const t = setTimeout(() => setBubble(null), 8000)
    return () => clearTimeout(t)
  }, [latest])

  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(x, MARGIN), window.innerWidth - SIZE - MARGIN),
    y: Math.min(Math.max(y, MARGIN), window.innerHeight - SIZE - MARGIN),
  })

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { sx: e.clientX, sy: e.clientY, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = rootRef.current
    if (!d || !el) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    if (!d.moved) {
      d.moved = true
      d.sx = e.clientX
      d.sy = e.clientY
    }
    const r = el.getBoundingClientRect()
    setPos(clamp(r.left + dx, r.top + dy))
    d.sx = e.clientX
    d.sy = e.clientY
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d?.moved) return
    if (bubble?.link && (e.target as HTMLElement).closest('[data-bubble]')) {
      router.push(bubble.link)
      setBubble(null)
      return
    }
    router.push('/assistant')
  }

  // Hidden on the assistant itself and on step feeds — the head's default
  // spot would sit on top of the composer's send button there.
  if (pathname.startsWith('/assistant') || pathname.includes('/progress')) return null

  const onRight = pos ? pos.x > window.innerWidth / 2 : true
  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { right: MARGIN + 4, bottom: 'calc(4rem + env(safe-area-inset-bottom) + 16px)' }

  return (
    <div
      ref={rootRef}
      className="md:hidden fixed z-50"
      style={{ ...style, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null }}
    >
      {bubble && (
        <button
          data-bubble
          className={`absolute top-1/2 -translate-y-1/2 w-52 rounded-2xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-3.5 py-2.5 shadow-xl shadow-black/40 text-left ${
            onRight ? 'right-full mr-2' : 'left-full ml-2'
          }`}
        >
          <p className="text-xs text-[hsl(var(--color-text-primary))] line-clamp-3">{bubble.text}</p>
        </button>
      )}
      <div className="relative w-[52px] h-[52px] rounded-full bg-[hsl(var(--color-primary))] shadow-lg shadow-black/40 flex items-center justify-center active:scale-95 transition-transform">
        <Sparkles className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
    </div>
  )
}
