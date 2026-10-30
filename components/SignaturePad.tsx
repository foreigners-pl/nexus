'use client'

import { useRef, useState, useEffect } from 'react'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
}

/** Canvas signature pad — works with mouse and touch. */
export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Scale for high-DPI screens
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    ctx.scale(ratio, ratio)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, rect.width, rect.height)
  }, [])

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent) => {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    canvasRef.current!.setPointerCapture(e.pointerId)
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setEmpty(false)
    onChange(canvasRef.current!.toDataURL('image/png'))
  }

  const end = () => {
    drawing.current = false
  }

  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-40 rounded-xl border border-[hsl(var(--color-border))] bg-white cursor-crosshair touch-none"
      />
      <div className="flex justify-between items-center mt-1.5">
        <p className="text-[11px] text-[hsl(var(--color-text-muted))]">Sign with your mouse or finger</p>
        <button type="button" onClick={clear} disabled={empty} className="text-xs text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] disabled:opacity-40">
          Clear
        </button>
      </div>
    </div>
  )
}
