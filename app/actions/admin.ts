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

function cleanLine(line: string) {
  return line.replace(/^[-•·]\s*/, '').trim()
}

function extractPrice(line: string): { text: string; price: number | null } {
  // Look for patterns like "- 2,599", " - 199pln", " - 6,399pln"
  const match = line.match(/(.+?)\s*[-–—]\s*([\d\s,]+)(?:\s*pln)?$/i)
  if (match) {
    const priceText = match[2].replace(/\s/g, '').replace(/,/g, '')
    const price = parseInt(priceText, 10)
    if (!isNaN(price)) {
      return { text: match[1].trim(), price }
    }
  }
  return { text: line, price: null }
}

export async function parseServiceProtocol(base64Docx: string): Promise<ParsedProtocol & { error?: string }> {
  try {
    const buffer = Buffer.from(base64Docx, 'base64')
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)

    const idx = (keywords: string[]) =>
      lines.findIndex(l => keywords.some(k => l.toLowerCase().includes(k)))

    const titleIdx = idx(['service protocol template', 'service protocol'])
    const outlineIdx = idx(['service outline'])
    const mandatoryIdx = idx(['mandatory stages'])
    const optionIdx = idx(['option stages'])
    const eligibilityIdx = idx(['eligibility verification'])
    const statusIdx = idx(['status verification'])
    const docsIdx = idx(['mandatory documents'])
    const executionIdx = idx(['execution and completion'])
    const closureIdx = idx(['service closure'])

    const between = (start: number, end: number) => {
      if (start < 0) return []
      const stop = end > start ? end : lines.length
      return lines.slice(start + 1, stop)
    }

    // Service description is the "Description:" line right after the title or before Service Outline
    let serviceDescription = ''
    const descLine = lines.find(l => l.toLowerCase().startsWith('description:'))
    if (descLine) {
      serviceDescription = descLine.replace(/^description:/i, '').trim()
    }

    // Service price from "Mandatory Stages - 2,599"
    let servicePrice: number | null = null
    if (mandatoryIdx >= 0) {
      const { price } = extractPrice(lines[mandatoryIdx])
      servicePrice = price
    }

    const parseStepList = (sectionStart: number, sectionEnd: number, isRequired: boolean): ParsedStep[] => {
      const raw = between(sectionStart, sectionEnd)
      const steps: ParsedStep[] = []
      let currentDesc = ''
      for (const line of raw) {
        if (line.toLowerCase().startsWith('description:')) {
          currentDesc = line.replace(/^description:/i, '').trim()
          continue
        }
        if (/^\d+\s+/.test(line)) continue // skip summary lines like "3 additional documents"
        const cleaned = cleanLine(line)
        if (!cleaned) continue
        const { text, price } = extractPrice(cleaned)
        steps.push({
          name: text,
          description: currentDesc,
          price,
          isRequired,
        })
        currentDesc = ''
      }
      return steps
    }

    const steps: ParsedStep[] = []
    if (mandatoryIdx >= 0) {
      steps.push(...parseStepList(mandatoryIdx, optionIdx > mandatoryIdx ? optionIdx : eligibilityIdx, true))
    }
    if (optionIdx >= 0) {
      steps.push(...parseStepList(optionIdx, eligibilityIdx > optionIdx ? eligibilityIdx : executionIdx, false))
    }

    const parseEligibilityItems = (sectionStart: number, sectionEnd: number): ParsedEligibilityItem[] => {
      const raw = between(sectionStart, sectionEnd)
      const items: ParsedEligibilityItem[] = []
      let sectionDesc = ''
      for (const line of raw) {
        if (line.toLowerCase().startsWith('description:')) {
          sectionDesc = line.replace(/^description:/i, '').trim()
          continue
        }
        const cleaned = cleanLine(line)
        if (!cleaned) continue
        items.push({
          title: cleaned,
          description: sectionDesc,
        })
        sectionDesc = ''
      }
      return items
    }

    const statusItems = statusIdx >= 0
      ? parseEligibilityItems(statusIdx, docsIdx > statusIdx ? docsIdx : executionIdx)
      : []
    const documentItems = docsIdx >= 0
      ? parseEligibilityItems(docsIdx, executionIdx > docsIdx ? executionIdx : closureIdx)
      : []

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
