'use server'

import { createClient } from '@/lib/supabase/server'
import mammoth from 'mammoth'
import type { Service } from '@/types/database'

export async function getServices(): Promise<Service[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('services').select('*').order('name')
  return (data || []) as Service[]
}

export interface ParsedStep {
  name: string
  description: string
  price: number | null
  isRequired: boolean
}

export interface ParsedEligibilityItem {
  title: string
  description: string
}

export interface ParsedOptionItem {
  name: string
  price: number | null
}

export interface ParsedProtocol {
  serviceName: string
  serviceDescription: string
  servicePrice: number | null
  steps: ParsedStep[]
  optionalStages: ParsedOptionItem[]
  allInclusive: { name: string; price: number | null; items: string[] } | null
  executionStages: { name: string; items: string[] }[]
  closureStages: string[]
  statusItems: ParsedEligibilityItem[]
  documentItems: ParsedEligibilityItem[]
}

function extractPrice(text: string): { name: string; price: number | null } {
  const match = text.match(/(.+?)\s*[-–—]\s*([\d\s,]+)(?:\s*pln)?$/i)
  if (match) {
    const priceText = match[2].replace(/\s/g, '').replace(/,/g, '')
    const price = parseInt(priceText, 10)
    if (!isNaN(price)) {
      return { name: match[1].trim(), price }
    }
  }
  return { name: text, price: null }
}

function normalizeHtml(html: string) {
  return html
    .replace(/<\/?strong>/gi, '')
    .replace(/<\/?em>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<ul>/gi, '\n[UL_START]\n')
    .replace(/<\/ul>/gi, '\n[UL_END]\n')
    .replace(/<ol>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li>/gi, '\n[LI] ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
}

export async function parseServiceProtocol(base64Docx: string): Promise<ParsedProtocol & { error?: string }> {
  try {
    const buffer = Buffer.from(base64Docx, 'base64')
    const htmlResult = await mammoth.convertToHtml({ buffer })
    const raw = normalizeHtml(htmlResult.value)
    const lines = raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)

    let serviceDescription = ''
    let servicePrice: number | null = null
    const steps: ParsedStep[] = []
    const optionalStages: ParsedOptionItem[] = []
    let allInclusive: { name: string; price: number | null; items: string[] } | null = null
    const executionStages: { name: string; items: string[] }[] = []
    const closureStages: string[] = []
    const statusItems: ParsedEligibilityItem[] = []
    const documentItems: ParsedEligibilityItem[] = []

    let topSection: 'outline' | 'eligibility' | 'execution' | 'closure' | null = null
    let subsection = ''
    let inList = false
    let pendingDescription = ''
    let listBuffer: string[] = []

    const isHeading = (text: string, keyword: string) =>
      text.toLowerCase().includes(keyword)

    const flushList = () => {
      if (!inList || listBuffer.length === 0) {
        listBuffer = []
        pendingDescription = ''
        inList = false
        return
      }

      if (topSection === 'outline') {
        if (isHeading(subsection, 'mandatory stages')) {
          for (const item of listBuffer) {
            const { name, price } = extractPrice(item)
            steps.push({ name, description: '', price, isRequired: true })
          }
        } else if (isHeading(subsection, 'optional stages') || isHeading(subsection, 'option stages')) {
          for (const item of listBuffer) {
            const { name, price } = extractPrice(item)
            optionalStages.push({ name, price })
          }
        } else if (isHeading(subsection, 'all inclusive')) {
          const { name, price } = extractPrice(subsection)
          allInclusive = { name, price, items: listBuffer.filter(Boolean) }
        }
      } else if (topSection === 'eligibility') {
        const target = isHeading(subsection, 'status')
          ? statusItems
          : documentItems
        for (const item of listBuffer) {
          target.push({ title: item, description: '' })
        }
      } else if (topSection === 'execution') {
        executionStages.push({ name: subsection, items: listBuffer.filter(Boolean) })
      } else if (topSection === 'closure') {
        closureStages.push(...listBuffer.filter(Boolean))
      }

      listBuffer = []
      pendingDescription = ''
      inList = false
    }

    for (const line of lines) {
      if (line === '[UL_START]') {
        inList = true
        continue
      }
      if (line === '[UL_END]') {
        flushList()
        continue
      }

      const lower = line.toLowerCase()

      if (lower.startsWith('description:')) {
        pendingDescription = line.replace(/^description:/i, '').trim()
        continue
      }

      // Top-level sections (DOCX renders these as ordered-list items, so strip [LI])
      if (isHeading(line, 'service outline')) {
        flushList()
        topSection = 'outline'
        subsection = ''
        continue
      }
      if (isHeading(line, 'eligibility verification')) {
        flushList()
        topSection = 'eligibility'
        subsection = ''
        continue
      }
      if (isHeading(line, 'execution and completion')) {
        flushList()
        topSection = 'execution'
        subsection = ''
        continue
      }
      if (isHeading(line, 'service closure')) {
        flushList()
        topSection = 'closure'
        subsection = ''
        continue
      }

      // First "Description:" before any section = service description
      if (!serviceDescription && pendingDescription && !topSection) {
        serviceDescription = pendingDescription
        pendingDescription = ''
        continue
      }

      // Subsection headings
      if (topSection && line && !lower.startsWith('[li] ')) {
        flushList()
        subsection = line
        if (topSection === 'outline' && isHeading(line, 'mandatory stages')) {
          const { price } = extractPrice(line)
          servicePrice = price
        }
        continue
      }

      // Regular list items
      if (lower.startsWith('[li] ')) {
        const item = line.replace(/^\[li\]\s*/i, '').trim()
        if (item) listBuffer.push(item)
        continue
      }
    }

    flushList()

    return {
      serviceName: '',
      serviceDescription,
      servicePrice,
      steps,
      optionalStages,
      allInclusive,
      executionStages,
      closureStages,
      statusItems,
      documentItems,
    }
  } catch (e: any) {
    return {
      serviceName: '',
      serviceDescription: '',
      servicePrice: null,
      steps: [],
      optionalStages: [],
      allInclusive: null,
      executionStages: [],
      closureStages: [],
      statusItems: [],
      documentItems: [],
      error: e?.message || 'Failed to parse document',
    }
  }
}

export async function saveServiceProtocol(
  serviceId: string,
  data: ParsedProtocol
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const protocolExtras = {
    optionalStages: data.optionalStages,
    allInclusive: data.allInclusive,
    executionStages: data.executionStages,
    closureStages: data.closureStages,
  }

  const updates: Record<string, unknown> = {
    description: data.serviceDescription,
    gross_price: data.servicePrice,
    protocol_extras: protocolExtras,
  }
  if (data.serviceName.trim()) {
    updates.name = data.serviceName.trim()
  }

  const { error: svcError } = await supabase
    .from('services')
    .update(updates)
    .eq('id', serviceId)

  if (svcError) return { success: false, error: svcError.message }

  // Replace existing service steps with mandatory steps only
  await supabase.from('service_steps').delete().eq('service_id', serviceId)

  const stepInserts = data.steps.map((step, i) => ({
    service_id: serviceId,
    name: step.name,
    description: step.description,
    position: i * 100,
    is_required: true,
  }))

  if (stepInserts.length > 0) {
    const { error } = await supabase.from('service_steps').insert(stepInserts)
    if (error) return { success: false, error: error.message }
  }

  // Replace existing eligibility items
  await supabase.from('service_eligibility').delete().eq('service_id', serviceId)

  const eligibilityInserts = [
    ...data.statusItems.map((item, i) => ({
      service_id: serviceId,
      type: 'status' as const,
      title: item.title,
      description: item.description,
      position: i,
    })),
    ...data.documentItems.map((item, i) => ({
      service_id: serviceId,
      type: 'documents' as const,
      title: item.title,
      description: item.description,
      position: i,
    })),
  ]

  if (eligibilityInserts.length > 0) {
    const { error } = await supabase.from('service_eligibility').insert(eligibilityInserts)
    if (error) return { success: false, error: error.message }
  }

  return { success: true }
}
