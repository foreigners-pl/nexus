'use client'

import { useState, useEffect, useRef } from 'react'
import { WikiDocument } from '@/types/database'
import { updateWikiDocument } from '@/app/actions/wiki'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface TableEditorProps {
  document: WikiDocument
  canEdit: boolean
  onUpdate: () => void
}

type ColumnType = 'text' | 'checkbox' | 'dropdown' | 'date'

interface ColumnConfig {
  name: string
  type: ColumnType
  width: number
  options?: string[]
}

interface TableData {
  columns: ColumnConfig[]
  rows: Record<string, any>[]
}

const DEFAULT_TABLE: TableData = {
  columns: [
    { name: 'A', type: 'text', width: 125 },
    { name: 'B', type: 'text', width: 125 },
    { name: 'C', type: 'text', width: 125 },
  ],
  rows: [
    { id: '1' },
    { id: '2' },
    { id: '3' },
  ]
}

const getColumnLabel = (index: number): string => {
  return String.fromCharCode(65 + index) // A, B, C, D, etc.
}

export function TableEditor({ document, canEdit, onUpdate }: TableEditorProps) {
  const [tableData, setTableData] = useState<TableData>(DEFAULT_TABLE)
  const [title, setTitle] = useState(document.title)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'row' | 'column', id: string | number } | null>(null)
  const [editingColumn, setEditingColumn] = useState<number | null>(null)
  const [editColumnType, setEditColumnType] = useState<ColumnType>('text')
  const [editOptionsText, setEditOptionsText] = useState('')
  const [resizingColumn, setResizingColumn] = useState<number | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [editingColumnName, setEditingColumnName] = useState<number | null>(null)
  const [tempColumnName, setTempColumnName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const titleTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    if (document.content && typeof document.content === 'object') {
      if ('headers' in document.content) {
        const oldData = document.content as { headers: string[], rows: string[][] }
        const newData: TableData = {
          columns: oldData.headers.map((h, idx) => ({ name: getColumnLabel(idx), type: 'text' as ColumnType, width: 125 })),
          rows: oldData.rows.map((row, idx) => {
            const rowData: Record<string, any> = { id: String(idx + 1) }
            row.forEach((cell, cellIdx) => {
              rowData[String(cellIdx)] = cell
            })
            return rowData
          })
        }
        setTableData(newData)
      } else {
        const data = document.content as TableData
        const updatedData = {
          ...data,
          columns: data.columns.map((col, idx) => ({ ...col, name: getColumnLabel(idx) }))
        }
        setTableData(updatedData)
      }
    }
    setTitle(document.title)
  }, [document.id, document.content, document.title])

  useEffect(() => {
    if (resizingColumn === null) return

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX
      const newWidth = Math.max(100, resizeStartWidth + diff)
      
      setTableData(prev => {
        const newData = { ...prev }
        newData.columns = [...prev.columns]
        newData.columns[resizingColumn] = { ...prev.columns[resizingColumn], width: newWidth }
        return newData
      })
    }

    const handleMouseUp = () => {
      setResizingColumn(null)
      saveContent(tableData)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth])

  const saveContent = async (data: TableData) => {
    if (!canEdit) return
    setIsSaving(true)
    await updateWikiDocument(document.id, { content: data })
    setLastSaved(new Date())
    setIsSaving(false)
    onUpdate()
  }

  const saveTitle = async (newTitle: string) => {
    if (!canEdit) return
    await updateWikiDocument(document.id, { title: newTitle })
    onUpdate()
  }

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current)
    titleTimeoutRef.current = setTimeout(() => saveTitle(newTitle), 500)
  }

  const handleCellChange = (rowId: string, colIndex: number, value: any) => {
    if (!canEdit) return
    
    const newData = { ...tableData }
    const row = newData.rows.find(r => r.id === rowId)
    if (row) {
      row[String(colIndex)] = value
    }
    setTableData(newData)

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => saveContent(newData), 1000)
  }

  const openColumnConfig = (colIndex: number) => {
    const column = tableData.columns[colIndex]
    setEditColumnType(column.type)
    setEditOptionsText(column.options?.join(', ') || 'Option 1, Option 2')
    setEditingColumn(colIndex)
  }

  const saveColumnConfig = () => {
    if (!canEdit || editingColumn === null) return
    const newData = { ...tableData }
    newData.columns[editingColumn].type = editColumnType
    
    if (editColumnType === 'dropdown') {
      const options = editOptionsText.split(',').map(o => o.trim()).filter(o => o.length > 0)
      newData.columns[editingColumn].options = options.length > 0 ? options : ['Option 1']
    }
    
    setTableData(newData)
    saveContent(newData)
    setEditingColumn(null)
  }

  const startColumnRename = (colIndex: number) => {
    setEditingColumnName(colIndex)
    setTempColumnName(tableData.columns[colIndex].name)
  }

  const saveColumnName = (colIndex: number) => {
    if (!canEdit) return
    const newName = tempColumnName.trim()
    if (newName && newName !== tableData.columns[colIndex].name) {
      const newData = { ...tableData }
      newData.columns[colIndex].name = newName
      setTableData(newData)
      saveContent(newData)
    }
    setEditingColumnName(null)
  }

  const cancelColumnRename = () => {
    setEditingColumnName(null)
    setTempColumnName('')
  }

  const toggleRowSelection = (rowId: string) => {
    const newSelection = new Set(selectedRows)
    if (newSelection.has(rowId)) {
      newSelection.delete(rowId)
    } else {
      newSelection.add(rowId)
    }
    setSelectedRows(newSelection)
  }

  const toggleColumnSelection = (colIndex: number) => {
    const newSelection = new Set(selectedColumns)
    if (newSelection.has(colIndex)) {
      newSelection.delete(colIndex)
    } else {
      newSelection.add(colIndex)
    }
    setSelectedColumns(newSelection)
  }

  const addRow = () => {
    if (!canEdit) return
    const newData = {
      ...tableData,
      rows: [...tableData.rows, { id: String(Date.now()) }]
    }
    setTableData(newData)
    saveContent(newData)
  }

  const addColumn = () => {
    if (!canEdit) return
    const newData = {
      ...tableData,
      columns: [...tableData.columns, { name: getColumnLabel(tableData.columns.length), type: 'text' as ColumnType, width: 250 }]
    }
    setTableData(newData)
    saveContent(newData)
  }

  const confirmDeleteRows = () => {
    if (selectedRows.size === 0) return
    setDeleteTarget({ type: 'row', id: Array.from(selectedRows).join(',') })
    setShowDeleteModal(true)
  }

  const confirmDeleteColumns = () => {
    if (selectedColumns.size === 0) return
    setDeleteTarget({ type: 'column', id: Array.from(selectedColumns).join(',') })
    setShowDeleteModal(true)
  }

  const executeDelete = () => {
    if (!deleteTarget) return

    if (deleteTarget.type === 'row') {
      const rowsToDelete = new Set(deleteTarget.id.toString().split(','))
      if (tableData.rows.length - rowsToDelete.size < 1) {
        alert('Cannot delete all rows')
        setShowDeleteModal(false)
        return
      }
      
      const newData = {
        ...tableData,
        rows: tableData.rows.filter(r => !rowsToDelete.has(r.id))
      }
      setTableData(newData)
      saveContent(newData)
      setSelectedRows(new Set())
    } else {
      const colsToDelete = new Set(deleteTarget.id.toString().split(',').map(Number))
      if (tableData.columns.length - colsToDelete.size < 1) {
        alert('Cannot delete all columns')
        setShowDeleteModal(false)
        return
      }

      const newData = {
        ...tableData,
        columns: tableData.columns.filter((_, i) => !colsToDelete.has(i)).map((col, idx) => ({ ...col, name: getColumnLabel(idx) })),
        rows: tableData.rows.map(row => {
          const newRow: Record<string, any> = { id: row.id }
          let newColIndex = 0
          Object.keys(row).forEach(key => {
            if (key !== 'id') {
              const colIdx = Number(key)
              if (!colsToDelete.has(colIdx)) {
                newRow[String(newColIndex)] = row[key]
                newColIndex++
              }
            }
          })
          return newRow
        })
      }
      setTableData(newData)
      saveContent(newData)
      setSelectedColumns(new Set())
    }

    setShowDeleteModal(false)
    setDeleteTarget(null)
  }

  const renderCell = (row: Record<string, any>, colIndex: number) => {
    const column = tableData.columns[colIndex]
    const value = row[String(colIndex)] || ''

    switch (column.type) {
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => handleCellChange(row.id, colIndex, e.target.checked)}
            disabled={!canEdit}
            className="w-4 h-4"
          />
        )
      case 'dropdown':
        return (
          <select
            value={value}
            onChange={(e) => handleCellChange(row.id, colIndex, e.target.value)}
            disabled={!canEdit}
            className="w-full bg-neutral-800 text-neutral-200 outline-none disabled:opacity-50 border border-neutral-700 rounded px-1"
          >
            <option value="">Select...</option>
            {column.options?.map((opt, idx) => (
              <option key={idx} value={opt}>{opt}</option>
            ))}
          </select>
        )
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleCellChange(row.id, colIndex, e.target.value)}
            disabled={!canEdit}
            className="w-full bg-transparent text-neutral-200 outline-none disabled:opacity-50"
          />
        )
      case 'text':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleCellChange(row.id, colIndex, e.target.value)}
            disabled={!canEdit}
            className="w-full bg-transparent text-neutral-200 outline-none disabled:opacity-50"
          />
        )
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          disabled={!canEdit}
          className="text-2xl font-bold mb-4 bg-transparent border-none outline-none text-neutral-100 placeholder-neutral-500 disabled:opacity-50"
          placeholder="Table title..."
        />

        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm text-neutral-500">
            {isSaving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
          </div>
          <div className="text-sm text-neutral-500">
            {tableData.rows.length} {tableData.rows.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <Button onClick={addRow} disabled={!canEdit} variant="secondary" size="sm">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Row
          </Button>
          <Button onClick={addColumn} disabled={!canEdit} variant="secondary" size="sm">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Column
          </Button>
          
          {selectedRows.size > 0 && (
            <Button onClick={confirmDeleteRows} disabled={!canEdit} variant="secondary" size="sm">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete {selectedRows.size} Row{selectedRows.size > 1 ? 's' : ''}
            </Button>
          )}
          
          {selectedColumns.size > 0 && (
            <Button onClick={confirmDeleteColumns} disabled={!canEdit} variant="secondary" size="sm">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete {selectedColumns.size} Column{selectedColumns.size > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-auto border border-neutral-700 rounded scrollbar-thin">
        <table className="border-collapse" style={{ width: `${tableData.columns.reduce((sum, col) => sum + col.width, 48)}px`, minWidth: '100%' }}>
          <thead>
            <tr>
              <th className="border border-neutral-700 bg-neutral-800 w-8 p-0 sticky left-0 z-10"></th>
              {tableData.columns.map((column, colIndex) => (
                <th 
                  key={colIndex} 
                  className={`border border-neutral-700 bg-neutral-800 p-0 relative group ${selectedColumns.has(colIndex) ? 'bg-red-900/30' : ''}`}
                  style={{ width: `${column.width}px`, minWidth: `${column.width}px`, maxWidth: `${column.width}px` }}
                >
                  <div className="p-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {canEdit && (
                        <input
                          type="checkbox"
                          checked={selectedColumns.has(colIndex)}
                          onChange={() => toggleColumnSelection(colIndex)}
                          className={`w-4 h-4 transition-opacity flex-shrink-0 ${selectedColumns.has(colIndex) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        />
                      )}
                      {editingColumnName === colIndex ? (
                        <input
                          type="text"
                          value={tempColumnName}
                          onChange={(e) => setTempColumnName(e.target.value)}
                          onBlur={() => saveColumnName(colIndex)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveColumnName(colIndex)
                            if (e.key === 'Escape') cancelColumnRename()
                          }}
                          autoFocus
                          className="bg-neutral-700 text-neutral-100 font-semibold px-2 py-0.5 rounded border border-blue-500 outline-none w-full min-w-0"
                        />
                      ) : (
                        <span 
                          className="text-neutral-100 font-semibold cursor-text hover:text-blue-400 transition-colors truncate"
                          onClick={() => canEdit && startColumnRename(colIndex)}
                          onDoubleClick={() => canEdit && startColumnRename(colIndex)}
                        >
                          {column.name}
                        </span>
                      )}
                    </div>
                    
                    {canEdit && (
                      <button
                        onClick={() => openColumnConfig(colIndex)}
                        className="p-1 hover:bg-neutral-700 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                        title="Configure column"
                      >
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {canEdit && (
                    <div
                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 bg-neutral-600 z-10"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setResizingColumn(colIndex)
                        setResizeStartX(e.clientX)
                        setResizeStartWidth(column.width)
                      }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, rowIndex) => (
              <tr key={row.id} className={`group ${selectedRows.has(row.id) ? 'bg-red-900/20' : ''}`}>
                <td className="border border-neutral-700 bg-neutral-800 p-2 text-center sticky left-0 z-10">
                  {canEdit && (
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.id)}
                      onChange={() => toggleRowSelection(row.id)}
                      className={`w-4 h-4 transition-opacity ${selectedRows.has(row.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    />
                  )}
                </td>
                {tableData.columns.map((column, colIndex) => (
                  <td 
                    key={colIndex} 
                    className="border border-neutral-700 p-2"
                    style={{ width: `${column.width}px`, minWidth: `${column.width}px`, maxWidth: `${column.width}px` }}
                  >
                    {renderCell(row, colIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDeleteTarget(null)
        }}
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-neutral-300">
            Are you sure you want to delete {deleteTarget?.type === 'row' 
              ? `${deleteTarget.id.toString().split(',').length} row(s)`
              : `${deleteTarget?.id.toString().split(',').length} column(s)`
            }? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="ghost" 
              onClick={() => {
                setShowDeleteModal(false)
                setDeleteTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={executeDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editingColumn !== null}
        onClose={() => setEditingColumn(null)}
        title="Column Settings"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Column Type
            </label>
            <select
              value={editColumnType}
              onChange={(e) => setEditColumnType(e.target.value as ColumnType)}
              className="w-full bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-3 py-2 outline-none focus:border-neutral-500"
            >
              <option value="text">Text</option>
              <option value="checkbox">Checkbox</option>
              <option value="dropdown">Dropdown</option>
              <option value="date">Date</option>
            </select>
          </div>
          
          {editColumnType === 'dropdown' && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Dropdown Options (comma-separated)
              </label>
              <input
                type="text"
                value={editOptionsText}
                onChange={(e) => setEditOptionsText(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                className="w-full bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-3 py-2 outline-none focus:border-neutral-500"
              />
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="ghost" 
              onClick={() => setEditingColumn(null)}
            >
              Cancel
            </Button>
            <Button onClick={saveColumnConfig}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
