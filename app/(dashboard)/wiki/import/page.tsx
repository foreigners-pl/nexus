'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { importWiki } from '@/app/actions/wiki'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// The wiki content structure based on the confirmed folder mapping
// Section titles must match exactly as they appear in the markdown (after "# ")
const WIKI_STRUCTURE: { [folderName: string]: string[] } = {
  'Company Information': [
    'Goals',
    'Brand colors',
    'Emails',
    'Login Info',
    'Business Details/NIP/Address',
    'Job Offers',
    'Monthly Briefing Links',
  ],
  'Company Standards': [
    'Customer Success',
    'Marketing',
    'IT',
    'Legal',
  ],
  'Template Messages': [
    'Initial Info',
    'Promotions/Price Neogitation',
    'Consultation email',
  ],
  'Meetings': [
    '08.07.2025',
    '19.05.2025',
    'March',
    '03.03.2025',
    'February',
    '02.02.2025',
    '19.01.2025',
    '05.01.2025',
    '22.12.2024',
    '15.12.2024',
    '8.12.2024',
    '30.11.2024',
    '26.11.2024',
    '16.11.2024',
    '09.11.2024',
    '01.11.2024',
    '17.10.2024',
    '4.10.2024',
    '22.09.2024',
    '29.10.2025',
    '31.10.2025',
    '03.11.2025',
    '05.11.2025',
    '07.11.2025',
    '10.11.2025',
    '12.11.2025',
    '14.11.2025',
    '17.11.2025',
    '19.11.2025',
    '24.11.2025',
    '28.11.2025',
    '02.12.2025',
    '05.12.2025',
    '08.12.2025',
    '10.12.2025',
    '12.12.2025',
    '15.12.2025',
    '17.12.2025',
    '29.12.2025',
    '02.01.2025',
    '06.01.2025',
    '08.01.2026',
    '03.02.2026',
    '10/02/2026',
    '12.02.2026',
  ],
  'Contacts': [
    'Contacts',
    'Partners (in progress/numbers mismatch)',
  ],
  'Business Model': [
    'Service Prices',
    'Services & Pricing (Legacy)',
  ],
  'Miscellaneous': [
    'INVOICE LINKS',
    'Legal Processes',
  ],
}

// Raw wiki content (this would normally come from a file upload or fetch)
// For now we'll paste it inline since we have it
const WIKI_CONTENT = `[Content will be parsed from the markdown file]`

export default function WikiImportPage() {
  const router = useRouter()
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{success?: boolean; error?: string; imported?: {folders: number; documents: number}} | null>(null)
  const [wikiText, setWikiText] = useState('')

  const parseWikiContent = (content: string) => {
    // Split content by h1 headers
    const sections: { [key: string]: string } = {}
    const lines = content.split('\n')
    let currentSection = ''
    let currentContent: string[] = []
    
    for (const line of lines) {
      if (line.startsWith('# ') && !line.startsWith('## ')) {
        // Save previous section
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim()
        }
        currentSection = line.slice(2).trim()
        currentContent = []
      } else {
        currentContent.push(line)
      }
    }
    
    // Save last section
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim()
    }
    
    return sections
  }

  const buildImportData = (sections: { [key: string]: string }) => {
    const folders: { name: string; documents: { title: string; content: string }[] }[] = []
    
    // Track which sections were used
    const usedSections = new Set<string>()
    
    for (const [folderName, docTitles] of Object.entries(WIKI_STRUCTURE)) {
      const documents: { title: string; content: string }[] = []
      
      for (const title of docTitles) {
        // Find the section that matches this title
        const content = sections[title]
        if (content !== undefined) {
          usedSections.add(title)
          // Only add if there's actual content (not just whitespace)
          if (content.trim()) {
            documents.push({ title, content: content.trim() })
          }
        }
      }
      
      if (documents.length > 0) {
        folders.push({ name: folderName, documents })
      }
    }
    
    // Log any unused sections for debugging
    const unusedSections = Object.keys(sections).filter(s => !usedSections.has(s))
    if (unusedSections.length > 0) {
      console.log('Unused sections:', unusedSections)
    }
    
    return folders
  }

  const handleImport = async () => {
    if (!wikiText.trim()) {
      setResult({ error: 'Please paste the wiki markdown content first' })
      return
    }

    setImporting(true)
    setResult(null)

    try {
      const sections = parseWikiContent(wikiText)
      const importData = buildImportData(sections)
      
      console.log('Importing folders:', importData.map(f => `${f.name} (${f.documents.length} docs)`))
      
      const result = await importWiki(importData, false) // false = private wiki
      setResult(result)
      
      if (result.success) {
        setTimeout(() => {
          router.push('/wiki')
        }, 2000)
      }
    } catch (error) {
      setResult({ error: 'Failed to parse or import wiki content' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Import Wiki from Markdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste the wiki markdown content below. The content will be organized into the following folders:
          </p>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            {Object.entries(WIKI_STRUCTURE).map(([folder, docs]) => (
              <div key={folder} className="border rounded p-2">
                <div className="font-medium">{folder}</div>
                <div className="text-muted-foreground text-xs">
                  {docs.length} documents
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Wiki Markdown Content
            </label>
            <textarea
              className="w-full h-64 p-3 border rounded-md text-sm font-mono bg-background"
              placeholder="Paste the wiki markdown content here..."
              value={wikiText}
              onChange={(e) => setWikiText(e.target.value)}
            />
          </div>

          {result && (
            <div className={`p-3 rounded-md text-sm ${result.success ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'}`}>
              {result.success ? (
                <>
                  Successfully imported {result.imported?.folders} folders and {result.imported?.documents} documents.
                  Redirecting to wiki...
                </>
              ) : (
                result.error
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : 'Import Wiki'}
            </Button>
            <Button variant="ghost" onClick={() => router.push('/wiki')}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
