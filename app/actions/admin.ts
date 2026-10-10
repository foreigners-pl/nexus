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

export interface ParsedProtocol {
  serviceDescription: string
  servicePrice: number | null
  steps: ParsedStep[]
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
    const statusItems: ParsedEligibilityItem[] = []
    const documentItems: ParsedEligibilityItem[] = []

    let topSection: 'outline' | 'eligibility' | 'execution' | 'closure' | null = null
    let subsection = ''
    let inList = false
    let pendingDescription = ''
    let listBuffer: string[] = []

    const flushList = () => {
      if (!inList || listBuffer.length === 0) return

      if (topSection === 'outline') {
        if (subsection.toLowerCase().startsWith('mandatory stages')) {
          for (const item of listBuffer) {
            const { name, price } = extractPrice(item)
            steps.push({ name, description: pendingDescription, price, isRequired: true })
          }
        } else if (subsection.toLowerCase().startsWith('option stages')) {
          for (const item of listBuffer) {
            const { name, price } = extractPrice(item)
            steps.push({ name, description: pendingDescription, price, isRequired: false })
          }
        } else if (subsection.toLowerCase().startsWith('all inclusive')) {
          const { name, price } = extractPrice(subsection)
          steps.push({
            name,
            description: [pendingDescription, ...listBuffer].filter(Boolean).join(' · '),
            price,
            isRequired: false,
          })
        }
      } else if (topSection === 'eligibility') {
        const target = subsection.toLowerCase().includes('status')
          ? statusItems
          : documentItems
        for (const item of listBuffer) {
          target.push({ title: item, description: pendingDescription })
        }
      } else if (topSection === 'execution') {
        // Each execution subsection becomes one step; bullets become description
        steps.push({
          name: subsection,
          description: [pendingDescription, ...listBuffer].filter(Boolean).join(' · '),
          price: null,
          isRequired: true,
        })
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

      if (lower.startsWith('[li] ')) {
        const item = line.replace(/^\[li\]\s*/, '').trim()
        if (item) listBuffer.push(item)
        continue
      }

      if (lower.startsWith('description:')) {
        pendingDescription = line.replace(/^description:/i, '').trim()
        continue
      }

      // Top-level sections
      if (lower === 'service outline') {
        flushList()
        topSection = 'outline'
        subsection = ''
        continue
      }
      if (lower === 'eligibility verification') {
        flushList()
        topSection = 'eligibility'
        subsection = ''
        continue
      }
      if (lower === 'execution and completion') {
        flushList()
        topSection = 'execution'
        subsection = ''
        continue
      }
      if (lower === 'service closure') {
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
      if (topSection && line) {
        flushList()
        subsection = line
        if (topSection === 'outline' && lower.startsWith('mandatory stages')) {
          const { price } = extractPrice(line)
          servicePrice = price
        }
      }
    }

    flushList()

    return {
      serviceDescription,
      servicePrice,
      steps,
      statusItems,
      documentItems,
    }
  } catch (e: any) {
    return {
      serviceDescription: '',
      servicePrice: null,
      steps: [],
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

  const { error: svcError } = await supabase
    .from('services')
    .update({
      description: data.serviceDescription,
      gross_price: data.servicePrice,
    })
    .eq('id', serviceId)

  if (svcError) return { success: false, error: svcError.message }

  // Replace existing service steps
  await supabase.from('service_steps').delete().eq('service_id', serviceId)

  const stepInserts = data.steps.map((step, i) => ({
    service_id: serviceId,
    name: step.name,
    description: step.description,
    position: i * 100,
    is_required: step.isRequired,
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
