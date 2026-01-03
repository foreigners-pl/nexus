'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { FontFamily } from '@tiptap/extension-font-family'
import { useEffect, useRef, useState } from 'react'
import { WikiDocument } from '@/types/database'
import { updateWikiDocument } from '@/app/actions/wiki'

interface RichTextEditorProps {
  document: WikiDocument
  canEdit: boolean
  onUpdate: () => void
}

export function RichTextEditor({ document, canEdit, onUpdate }: RichTextEditorProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [title, setTitle] = useState('')
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 })
  const [showTextStyleDropdown, setShowTextStyleDropdown] = useState(false)
  const [showListStyleDropdown, setShowListStyleDropdown] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [documentFont, setDocumentFont] = useState('Inter, sans-serif')
  const [documentFontSize, setDocumentFontSize] = useState('16px')
  const [showDocFontDropdown, setShowDocFontDropdown] = useState(false)
  const [showDocFontSizeDropdown, setShowDocFontSizeDropdown] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout>(undefined)
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout>(undefined)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: document?.content || '<p></p>',
    editable: canEdit,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        handleSave({ content: editor.getJSON() })
      }, 1000)
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to
      
      if (hasSelection && canEdit) {
        const { view } = editor
        const start = view.coordsAtPos(from)
        const end = view.coordsAtPos(to)
        
        const left = (start.left + end.left) / 2
        const top = start.top - 60
        
        setToolbarPos({ top, left })
        setShowToolbar(true)
      } else {
        setShowToolbar(false)
      }
    },
  })

  useEffect(() => {
    if (editor && document) {
      const currentContent = editor.getJSON()
      const newContent = document.content || { type: 'doc', content: [{ type: 'paragraph' }] }
      if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
        editor.commands.setContent(newContent)
      }
    }
  }, [document?.id, editor])

  useEffect(() => {
    if (document) {
      setTitle(document.title)
    }
  }, [document?.id])

  useEffect(() => {
    if (editor) {
      editor.setEditable(canEdit)
    }
  }, [canEdit, editor])

  const handleSave = async (updates: { title?: string; content?: any }) => {
    if (!document || !canEdit) return
    setIsSaving(true)
    try {
      const result = await updateWikiDocument(document.id, updates)
      if (!result?.error) {
        setLastSaved(new Date())
        onUpdate?.()
      }
    } catch (error) {
      console.error('Failed to save document:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current)
    }
    titleSaveTimeoutRef.current = setTimeout(() => {
      handleSave({ title: newTitle })
    }, 500)
  }

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500">
        Select a document to start editing
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto relative">
      {/* Floating Toolbar */}
      {showToolbar && editor && (
        <div
          className="fixed bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl p-1 flex items-center gap-1 z-[9999]"
          style={{ top: `${toolbarPos.top}px`, left: `${toolbarPos.left}px`, transform: 'translateX(-50%)' }}
        >
          {/* Text Style Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTextStyleDropdown(!showTextStyleDropdown)
                setShowListStyleDropdown(false)
                setShowColorPicker(false)
              }}
              className="px-3 py-1.5 rounded hover:bg-neutral-800 text-neutral-300 w-[50px] text-center text-sm"
            >
              {editor.isActive('heading', { level: 1 }) ? 'H1' :
               editor.isActive('heading', { level: 2 }) ? 'H2' :
               editor.isActive('heading', { level: 3 }) ? 'H3' : 'P'}
            </button>
            {showTextStyleDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[80px] z-[9999]">
                <button onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setShowTextStyleDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 font-bold">H1</button>
                <button onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setShowTextStyleDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 font-semibold">H2</button>
                <button onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setShowTextStyleDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 font-medium">H3</button>
                <button onClick={() => { editor.chain().focus().setParagraph().run(); setShowTextStyleDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 text-sm">P</button>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-neutral-700" />

          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={() => {
                setShowColorPicker(!showColorPicker)
                setShowTextStyleDropdown(false)
                setShowListStyleDropdown(false)
              }}
              className="px-3 py-1.5 rounded hover:bg-neutral-800 flex items-center gap-1"
              title="Text Color"
            >
              <span className="text-neutral-300 text-sm font-bold">A</span>
              <div className="w-4 h-1 rounded" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#ffffff' }}></div>
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl p-2 z-[9999] flex gap-1">
                <button onClick={() => { editor.chain().focus().setColor('#ffffff').run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-white border border-neutral-600 hover:ring-2 hover:ring-red-500" title="White" />
                <button onClick={() => { editor.chain().focus().setColor('#ef4444').run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-red-500 hover:ring-2 hover:ring-red-500" title="Red" />
                <button onClick={() => { editor.chain().focus().setColor('#f97316').run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-orange-500 hover:ring-2 hover:ring-red-500" title="Orange" />
                <button onClick={() => { editor.chain().focus().setColor('#eab308').run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-yellow-500 hover:ring-2 hover:ring-red-500" title="Yellow" />
                <button onClick={() => { editor.chain().focus().setColor('#22c55e').run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-green-500 hover:ring-2 hover:ring-red-500" title="Green" />
                <button onClick={() => { editor.chain().focus().setColor('#3b82f6').run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-blue-500 hover:ring-2 hover:ring-red-500" title="Blue" />
                <button onClick={() => { editor.chain().focus().setColor('#8b5cf6').run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-violet-500 hover:ring-2 hover:ring-red-500" title="Violet" />
                <button onClick={() => { editor.chain().focus().setColor('#ec4899').run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-pink-500 hover:ring-2 hover:ring-red-500" title="Pink" />
                <button onClick={() => { editor.chain().focus().setColor('#a3a3a3').run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-neutral-400 hover:ring-2 hover:ring-red-500" title="Gray" />
                <button onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false) }} className="w-6 h-6 rounded bg-neutral-800 border border-neutral-600 hover:ring-2 hover:ring-red-500" title="Default" />
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-neutral-700" />

          {/* Basic Formatting */}
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-3 py-1.5 rounded hover:bg-neutral-800 ${editor.isActive('bold') ? 'bg-red-700 text-white' : 'text-neutral-300'}`} title="Bold"><strong>B</strong></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-3 py-1.5 rounded hover:bg-neutral-800 ${editor.isActive('italic') ? 'bg-red-700 text-white' : 'text-neutral-300'}`} title="Italic"><em>I</em></button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`px-3 py-1.5 rounded hover:bg-neutral-800 ${editor.isActive('underline') ? 'bg-red-700 text-white' : 'text-neutral-300'}`} title="Underline"><u>U</u></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`px-3 py-1.5 rounded hover:bg-neutral-800 ${editor.isActive('strike') ? 'bg-red-700 text-white' : 'text-neutral-300'}`} title="Strike"><s>S</s></button>

          <div className="w-px h-6 bg-neutral-700" />

          {/* List Style Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowListStyleDropdown(!showListStyleDropdown)
                setShowTextStyleDropdown(false)
                setShowColorPicker(false)
              }}
              className={`px-3 py-1.5 rounded hover:bg-neutral-800 ${editor.isActive('bulletList') || editor.isActive('orderedList') ? 'bg-red-700 text-white' : 'text-neutral-300'}`}
              title="Lists"
            >
              ☰
            </button>
            {showListStyleDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[140px] z-[9999]">
                <button onClick={() => { editor.chain().focus().toggleBulletList().run(); setShowListStyleDropdown(false) }} className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-300 text-sm">• Bullet List</button>
                <button onClick={() => { editor.chain().focus().toggleOrderedList().run(); setShowListStyleDropdown(false) }} className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-300 text-sm">1. Numbered List</button>
              </div>
            )}
          </div>
        </div>
      )}
      
      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        disabled={!canEdit}
        className="w-full text-3xl font-bold bg-transparent border-none outline-none text-white placeholder-neutral-600 mb-2 focus:text-red-500"
        placeholder="Untitled Document"
      />

      {/* Document-level Font Controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-sm text-neutral-500">
          {isSaving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
        </div>
        
        {canEdit && (
          <>
            <div className="relative">
              <button
                onClick={() => {
                  setShowDocFontDropdown(!showDocFontDropdown)
                  setShowDocFontSizeDropdown(false)
                }}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs border border-neutral-700"
              >
                Font: {documentFont.split(',')[0]}
              </button>
              {showDocFontDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[140px] z-[9999]">
                  <button onClick={() => { setDocumentFont('Inter, sans-serif'); setShowDocFontDropdown(false) }} className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-300 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>Inter</button>
                  <button onClick={() => { setDocumentFont('Georgia, serif'); setShowDocFontDropdown(false) }} className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-300 text-sm" style={{ fontFamily: 'Georgia, serif' }}>Georgia</button>
                  <button onClick={() => { setDocumentFont('Courier New, monospace'); setShowDocFontDropdown(false) }} className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-300 text-sm" style={{ fontFamily: 'Courier New, monospace' }}>Courier</button>
                  <button onClick={() => { setDocumentFont('Arial, sans-serif'); setShowDocFontDropdown(false) }} className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-300 text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>Arial</button>
                  <button onClick={() => { setDocumentFont('Times New Roman, serif'); setShowDocFontDropdown(false) }} className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-300 text-sm" style={{ fontFamily: 'Times New Roman, serif' }}>Times</button>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowDocFontSizeDropdown(!showDocFontSizeDropdown)
                  setShowDocFontDropdown(false)
                }}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs border border-neutral-700"
              >
                Size: {documentFontSize}
              </button>
              {showDocFontSizeDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[100px] z-[9999]">
                  <button onClick={() => { setDocumentFontSize('12px'); setShowDocFontSizeDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 text-sm">12px</button>
                  <button onClick={() => { setDocumentFontSize('14px'); setShowDocFontSizeDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 text-sm">14px</button>
                  <button onClick={() => { setDocumentFontSize('16px'); setShowDocFontSizeDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 text-sm">16px</button>
                  <button onClick={() => { setDocumentFontSize('18px'); setShowDocFontSizeDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 text-sm">18px</button>
                  <button onClick={() => { setDocumentFontSize('20px'); setShowDocFontSizeDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 text-sm">20px</button>
                  <button onClick={() => { setDocumentFontSize('24px'); setShowDocFontSizeDropdown(false) }} className="w-full px-3 py-1.5 text-center hover:bg-neutral-800 text-neutral-300 text-sm">24px</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div 
        className="flex-1 overflow-y-auto cursor-text"
        onClick={(e) => {
          if (e.target === e.currentTarget && editor) {
            editor.commands.focus('end')
          }
        }}
        style={{ fontFamily: documentFont, fontSize: documentFontSize }}
      >
        <EditorContent editor={editor} className="prose prose-invert max-w-none" />
      </div>
    </div>
  )
}