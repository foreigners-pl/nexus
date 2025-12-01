'use client'

import { useState, useEffect, useRef } from 'react'
import { WikiDocument } from '@/types/database'
import { updateWikiDocument } from '@/app/actions/wiki'
import { Button } from '@/components/ui/Button'

interface WhiteboardEditorProps {
  document: WikiDocument
  canEdit: boolean
  onUpdate: () => void
}

interface Box {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  textAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
}

interface Connection {
  id: string
  from: string
  to: string
}

export function WhiteboardEditor({ document, canEdit, onUpdate }: WhiteboardEditorProps) {
  const [title, setTitle] = useState(document.title)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedBox, setSelectedBox] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string, offsetX: number, offsetY: number } | null>(null)
  const [resizing, setResizing] = useState<{ id: string, edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw', startX: number, startY: number, startWidth: number, startHeight: number, startBoxX: number, startBoxY: number } | null>(null)
  const [draggingConnection, setDraggingConnection] = useState<{ fromBoxId: string, startX: number, startY: number, currentX: number, currentY: number } | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [boxIdCounter, setBoxIdCounter] = useState(1)
  const canvasRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const titleTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    setTitle(document.title)
    if (document.content && typeof document.content === 'object') {
      const content = document.content as any
      if (content.boxes) setBoxes(content.boxes)
      if (content.connections) setConnections(content.connections)
      if (content.boxIdCounter) setBoxIdCounter(content.boxIdCounter)
    }
  }, [document.id])

  const saveWhiteboard = () => {
    if (!canEdit) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      await updateWikiDocument(document.id, {
        content: { boxes, connections, boxIdCounter }
      })
    }, 2000)
  }

  useEffect(() => {
    saveWhiteboard()
  }, [boxes, connections])

  const saveTitle = async (newTitle: string) => {
    if (!canEdit) return
    await updateWikiDocument(document.id, { title: newTitle })
    onUpdate()
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current)
    titleTimeoutRef.current = setTimeout(() => saveTitle(newTitle), 500)
  }

  const addBox = () => {
    const newBox: Box = {
      id: `box-${boxIdCounter}`,
      x: 100 - pan.x,
      y: 100 - pan.y,
      width: 200,
      height: 100,
      text: 'New box',
      color: '#000000',
      fontSize: 14,
      fontWeight: 'normal',
      textAlign: 'center',
      verticalAlign: 'middle'
    }
    setBoxes([...boxes, newBox])
    setBoxIdCounter(boxIdCounter + 1)
  }

  const updateBox = (id: string, updates: Partial<Box>) => {
    setBoxes(boxes.map(box => box.id === id ? { ...box, ...updates } : box))
  }

  const deleteBox = (id: string) => {
    setBoxes(boxes.filter(box => box.id !== id))
    setConnections(connections.filter(conn => conn.from !== id && conn.to !== id))
    if (selectedBox === id) setSelectedBox(null)
  }

  const handleMouseDown = (e: React.MouseEvent, boxId: string) => {
    if (!canEdit || resizing) return
    e.stopPropagation()
    const box = boxes.find(b => b.id === boxId)
    if (box) {
      setSelectedBox(boxId)
      setDragging({
        id: boxId,
        offsetX: e.clientX - box.x * zoom - pan.x,
        offsetY: e.clientY - box.y * zoom - pan.y
      })
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !e.shiftKey) {
      setSelectedBox(null)
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging && canEdit) {
      const newX = (e.clientX - dragging.offsetX - pan.x) / zoom
      const newY = (e.clientY - dragging.offsetY - pan.y) / zoom
      updateBox(dragging.id, { x: newX, y: newY })
    } else if (resizing && canEdit) {
      const deltaX = (e.clientX - resizing.startX) / zoom
      const deltaY = (e.clientY - resizing.startY) / zoom
      
      let newWidth = resizing.startWidth
      let newHeight = resizing.startHeight
      let newX = resizing.startBoxX
      let newY = resizing.startBoxY
      
      // Handle resizing based on edge
      if (resizing.edge.includes('e')) {
        newWidth = Math.max(100, resizing.startWidth + deltaX)
      }
      if (resizing.edge.includes('w')) {
        const widthChange = Math.min(deltaX, resizing.startWidth - 100)
        newWidth = resizing.startWidth - widthChange
        newX = resizing.startBoxX + widthChange
      }
      if (resizing.edge.includes('s')) {
        newHeight = Math.max(50, resizing.startHeight + deltaY)
      }
      if (resizing.edge.includes('n')) {
        const heightChange = Math.min(deltaY, resizing.startHeight - 50)
        newHeight = resizing.startHeight - heightChange
        newY = resizing.startBoxY + heightChange
      }
      
      updateBox(resizing.id, {
        width: newWidth,
        height: newHeight,
        x: newX,
        y: newY
      })
    } else if (draggingConnection) {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const currentX = (e.clientX - rect.left - pan.x) / zoom
      const currentY = (e.clientY - rect.top - pan.y) / zoom
      setDraggingConnection({ ...draggingConnection, currentX, currentY })
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (draggingConnection) {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      // Check if dropped on a box
      const dropX = (e.clientX - rect.left - pan.x) / zoom
      const dropY = (e.clientY - rect.top - pan.y) / zoom
      
      let targetBox = boxes.find(box => 
        box.id !== draggingConnection.fromBoxId &&
        dropX >= box.x && dropX <= box.x + box.width &&
        dropY >= box.y && dropY <= box.y + box.height
      )
      
      if (targetBox) {
        // Connect to existing box
        const newConnection: Connection = {
          id: `conn-${Date.now()}`,
          from: draggingConnection.fromBoxId,
          to: targetBox.id
        }
        setConnections([...connections, newConnection])
      } else {
        // Create new box at drop location
        const newBox: Box = {
          id: `box-${boxIdCounter}`,
          x: dropX - 100,
          y: dropY - 50,
          width: 200,
          height: 100,
          text: 'New box',
          color: '#000000',
          fontSize: 14,
          fontWeight: 'normal',
          textAlign: 'center',
          verticalAlign: 'middle'
        }
        setBoxes([...boxes, newBox])
        const newConnection: Connection = {
          id: `conn-${Date.now()}`,
          from: draggingConnection.fromBoxId,
          to: newBox.id
        }
        setConnections([...connections, newConnection])
        setBoxIdCounter(boxIdCounter + 1)
      }
      setDraggingConnection(null)
    }
    setDragging(null)
    setResizing(null)
    setIsPanning(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(Math.min(Math.max(zoom * delta, 0.1), 3))
  }

  return (
    <div className="h-full flex flex-col">
      <input
        type="text"
        value={title}
        onChange={handleTitleChange}
        disabled={!canEdit}
        className="text-2xl font-bold mb-4 bg-transparent border-none outline-none text-neutral-100 placeholder-neutral-500 disabled:opacity-50"
        placeholder="Whiteboard title..."
      />

      {canEdit && (
        <div className="flex gap-2 mb-4">
          <Button onClick={addBox} variant="secondary" size="sm">
            + Add Box
          </Button>
        </div>
      )}

      <div
        ref={canvasRef}
        className="flex-1 border border-neutral-700 rounded-lg overflow-hidden relative bg-neutral-900"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: draggingConnection ? 'crosshair' : isPanning ? 'grabbing' : dragging ? 'grabbing' : 'grab' }}
      >
        {/* Floating toolbar above selected box */}
        {canEdit && selectedBox && (() => {
          const box = boxes.find(b => b.id === selectedBox)
          if (!box) return null
          
          // Calculate toolbar position
          const toolbarHeight = 50
          const toolbarWidth = 500 // approximate width
          let left = box.x * zoom + pan.x
          let top = box.y * zoom + pan.y - toolbarHeight - 10
          
          // Get canvas dimensions
          const canvas = canvasRef.current
          if (canvas) {
            const rect = canvas.getBoundingClientRect()
            
            // Keep toolbar within horizontal bounds
            if (left < 10) left = 10
            if (left + toolbarWidth > rect.width) left = rect.width - toolbarWidth - 10
            
            // If toolbar would go above canvas, place it below the box
            if (top < 10) {
              top = box.y * zoom + pan.y + box.height * zoom + 10
            }
          }
          
          return (
            <div
              className="absolute z-50 bg-neutral-800 border border-neutral-600 rounded-lg shadow-lg p-2 flex gap-2 items-center pointer-events-none"
              style={{
                left: `${left}px`,
                top: `${top}px`,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <select
                value={box.fontSize || 14}
                onChange={(e) => updateBox(selectedBox, { fontSize: parseInt(e.target.value) })}
                className="h-7 px-2 bg-neutral-700 text-neutral-200 rounded text-xs pointer-events-auto"
              >
                <option value="10">10px</option>
                <option value="12">12px</option>
                <option value="14">14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
                <option value="20">20px</option>
                <option value="24">24px</option>
              </select>
              <button
                onClick={() => updateBox(selectedBox, { fontWeight: box.fontWeight === 'bold' ? 'normal' : 'bold' })}
                className={`h-7 px-2 rounded text-xs font-bold pointer-events-auto ${
                  box.fontWeight === 'bold' ? 'bg-[#AB1604] text-white' : 'bg-neutral-700 text-neutral-200'
                }`}
                title="Bold"
              >
                B
              </button>
              <button
                onClick={() => updateBox(selectedBox, { fontWeight: box.fontWeight === 'italic' ? 'normal' : 'italic' })}
                className={`h-7 px-2 rounded text-xs italic pointer-events-auto ${
                  box.fontWeight === 'italic' ? 'bg-[#AB1604] text-white' : 'bg-neutral-700 text-neutral-200'
                }`}
                title="Italic"
              >
                I
              </button>
              <div className="w-px h-5 bg-neutral-600" />
              <select
                value={box.textAlign || 'center'}
                onChange={(e) => updateBox(selectedBox, { textAlign: e.target.value as any })}
                className="h-7 px-2 bg-neutral-700 text-neutral-200 rounded text-xs pointer-events-auto"
                title="Horizontal align"
              >
                <option value="left">←</option>
                <option value="center">↔</option>
                <option value="right">→</option>
              </select>
              <select
                value={box.verticalAlign || 'middle'}
                onChange={(e) => updateBox(selectedBox, { verticalAlign: e.target.value as any })}
                className="h-7 px-2 bg-neutral-700 text-neutral-200 rounded text-xs pointer-events-auto"
                title="Vertical align"
              >
                <option value="top">↑</option>
                <option value="middle">↕</option>
                <option value="bottom">↓</option>
              </select>
              <div className="w-px h-5 bg-neutral-600" />
              <input
                type="color"
                value={box.color || '#000000'}
                onChange={(e) => updateBox(selectedBox, { color: e.target.value })}
                className="h-7 w-12 rounded cursor-pointer pointer-events-auto"
                title="Color"
              />
              <button
                onClick={() => deleteBox(selectedBox)}
                className="h-7 px-2 rounded text-xs bg-red-600 hover:bg-red-700 text-white pointer-events-auto flex items-center gap-1"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )
        })()}
        
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <style>{`
            @keyframes dash {
              to {
                stroke-dashoffset: -20;
              }
            }
            .animated-connection {
              animation: dash 1s linear infinite;
            }
          `}</style>
          {connections.map(conn => {
            const from = boxes.find(b => b.id === conn.from)
            const to = boxes.find(b => b.id === conn.to)
            if (!from || !to) return null
            return (
              <line
                key={conn.id}
                x1={(from.x + from.width / 2) * zoom + pan.x}
                y1={(from.y + from.height / 2) * zoom + pan.y}
                x2={(to.x + to.width / 2) * zoom + pan.x}
                y2={(to.y + to.height / 2) * zoom + pan.y}
                stroke="#ffffff"
                strokeWidth={2}
                strokeDasharray="5,5"
                className="animated-connection"
              />
            )
          })}
          {draggingConnection && (
            <line
              x1={draggingConnection.startX * zoom + pan.x}
              y1={draggingConnection.startY * zoom + pan.y}
              x2={draggingConnection.currentX * zoom + pan.x}
              y2={draggingConnection.currentY * zoom + pan.y}
              stroke="#ffffff"
              strokeWidth={2}
              strokeDasharray="5,5"
              className="animated-connection"
            />
          )}
        </svg>

        <div
          className="absolute inset-0"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {boxes.map(box => (
            <div
              key={box.id}
              className={`absolute rounded-lg p-2 cursor-move ${ 
                selectedBox === box.id ? 'ring-1 ring-white' : ''
              }`}
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                backgroundColor: box.color,
                border: selectedBox === box.id ? '1px solid #ffffff' : '1px solid #404040',
              }}
              onMouseDown={(e) => handleMouseDown(e, box.id)}
            >
              <div 
                className="w-full h-full flex flex-col"
                style={{
                  justifyContent: box.verticalAlign === 'top' ? 'flex-start' : box.verticalAlign === 'bottom' ? 'flex-end' : 'center'
                }}
              >
                <textarea
                  value={box.text}
                  onChange={(e) => updateBox(box.id, { text: e.target.value })}
                  disabled={!canEdit}
                  className="w-full bg-transparent text-white outline-none resize-none select-none"
                  style={{ 
                    pointerEvents: canEdit ? 'auto' : 'none',
                    fontSize: `${box.fontSize || 14}px`,
                    fontWeight: box.fontWeight || 'normal',
                    textAlign: box.textAlign || 'center'
                  }}
                />
              </div>
              
              {canEdit && selectedBox === box.id && (
                <>
                  {/* Border resize zones */}
                  <div className="absolute -top-1 left-2 right-2 h-2 cursor-n-resize hover:bg-white/20" onMouseDown={(e) => { e.stopPropagation(); setDragging(null); setResizing({ id: box.id, edge: 'n', startX: e.clientX, startY: e.clientY, startWidth: box.width, startHeight: box.height, startBoxX: box.x, startBoxY: box.y }) }} />
                  <div className="absolute -bottom-1 left-2 right-2 h-2 cursor-s-resize hover:bg-white/20" onMouseDown={(e) => { e.stopPropagation(); setDragging(null); setResizing({ id: box.id, edge: 's', startX: e.clientX, startY: e.clientY, startWidth: box.width, startHeight: box.height, startBoxX: box.x, startBoxY: box.y }) }} />
                  <div className="absolute -left-1 top-2 bottom-2 w-2 cursor-w-resize hover:bg-white/20" onMouseDown={(e) => { e.stopPropagation(); setDragging(null); setResizing({ id: box.id, edge: 'w', startX: e.clientX, startY: e.clientY, startWidth: box.width, startHeight: box.height, startBoxX: box.x, startBoxY: box.y }) }} />
                  <div className="absolute -right-1 top-2 bottom-2 w-2 cursor-e-resize hover:bg-white/20" onMouseDown={(e) => { e.stopPropagation(); setDragging(null); setResizing({ id: box.id, edge: 'e', startX: e.clientX, startY: e.clientY, startWidth: box.width, startHeight: box.height, startBoxX: box.x, startBoxY: box.y }) }} />
                  <div className="absolute -top-1 -left-1 w-2 h-2 cursor-nw-resize hover:bg-white/30" onMouseDown={(e) => { e.stopPropagation(); setDragging(null); setResizing({ id: box.id, edge: 'nw', startX: e.clientX, startY: e.clientY, startWidth: box.width, startHeight: box.height, startBoxX: box.x, startBoxY: box.y }) }} />
                  <div className="absolute -top-1 -right-1 w-2 h-2 cursor-ne-resize hover:bg-white/30" onMouseDown={(e) => { e.stopPropagation(); setDragging(null); setResizing({ id: box.id, edge: 'ne', startX: e.clientX, startY: e.clientY, startWidth: box.width, startHeight: box.height, startBoxX: box.x, startBoxY: box.y }) }} />
                  <div className="absolute -bottom-1 -left-1 w-2 h-2 cursor-sw-resize hover:bg-white/30" onMouseDown={(e) => { e.stopPropagation(); setDragging(null); setResizing({ id: box.id, edge: 'sw', startX: e.clientX, startY: e.clientY, startWidth: box.width, startHeight: box.height, startBoxX: box.x, startBoxY: box.y }) }} />
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 cursor-se-resize hover:bg-white/30" onMouseDown={(e) => { e.stopPropagation(); setDragging(null); setResizing({ id: box.id, edge: 'se', startX: e.clientX, startY: e.clientY, startWidth: box.width, startHeight: box.height, startBoxX: box.x, startBoxY: box.y }) }} />
                  
                  {/* Connection dots */}
                  <div className="absolute w-3 h-3 rounded-full -top-1.5 left-1/2 -translate-x-1/2 cursor-crosshair z-10" style={{ backgroundColor: '#ffffff' }} onMouseDown={(e) => { e.stopPropagation(); setDragging(null); const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return; const startX = box.x + box.width / 2; const startY = box.y; const currentX = (e.clientX - rect.left - pan.x) / zoom; const currentY = (e.clientY - rect.top - pan.y) / zoom; setDraggingConnection({ fromBoxId: box.id, startX, startY, currentX, currentY }) }} />
                  <div className="absolute w-3 h-3 rounded-full -bottom-1.5 left-1/2 -translate-x-1/2 cursor-crosshair z-10" style={{ backgroundColor: '#ffffff' }} onMouseDown={(e) => { e.stopPropagation(); setDragging(null); const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return; const startX = box.x + box.width / 2; const startY = box.y + box.height; const currentX = (e.clientX - rect.left - pan.x) / zoom; const currentY = (e.clientY - rect.top - pan.y) / zoom; setDraggingConnection({ fromBoxId: box.id, startX, startY, currentX, currentY }) }} />
                  <div className="absolute w-3 h-3 rounded-full -left-1.5 top-1/2 -translate-y-1/2 cursor-crosshair z-10" style={{ backgroundColor: '#ffffff' }} onMouseDown={(e) => { e.stopPropagation(); setDragging(null); const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return; const startX = box.x; const startY = box.y + box.height / 2; const currentX = (e.clientX - rect.left - pan.x) / zoom; const currentY = (e.clientY - rect.top - pan.y) / zoom; setDraggingConnection({ fromBoxId: box.id, startX, startY, currentX, currentY }) }} />
                  <div className="absolute w-3 h-3 rounded-full -right-1.5 top-1/2 -translate-y-1/2 cursor-crosshair z-10" style={{ backgroundColor: '#ffffff' }} onMouseDown={(e) => { e.stopPropagation(); setDragging(null); const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return; const startX = box.x + box.width; const startY = box.y + box.height / 2; const currentX = (e.clientX - rect.left - pan.x) / zoom; const currentY = (e.clientY - rect.top - pan.y) / zoom; setDraggingConnection({ fromBoxId: box.id, startX, startY, currentX, currentY }) }} />
                </>
              )}
            </div>
          ))}
        </div>

        <div className="absolute bottom-4 right-4 text-neutral-500 text-sm pointer-events-none">
          {draggingConnection ? (
            <span style={{ color: '#AB1604' }}>Drop on box to connect, or on empty space to create & connect</span>
          ) : (
            <>Zoom: {(zoom * 100).toFixed(0)}% | Scroll to zoom, drag to pan</>
          )}
        </div>
      </div>
    </div>
  )
}
