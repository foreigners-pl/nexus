import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Messenger bot tools — each takes the resolved CRM user + args and talks to
 * the DB through the service-role client. User scoping is enforced HERE
 * (queries filter by userId explicitly) because the webhook has no session.
 */

type Supabase = ReturnType<typeof createAdminClient>

export interface BotUser {
  id: string
  display_name: string | null
  email: string
}

interface CaseRow {
  id: string
  case_code: string | null
  current_step_id: string | null
  csr_id: string | null
  assigned_to: string | null
  clients?: { first_name: string | null; last_name: string | null }[] | { first_name: string | null; last_name: string | null } | null
}

function clientName(c: CaseRow | { clients?: CaseRow['clients'] }): string {
  const raw = c.clients as any
  const cl = Array.isArray(raw) ? raw[0] : raw
  return [cl?.first_name, cl?.last_name].filter(Boolean).join(' ') || ''
}

/** Resolve "C0000582", "582", or a client-name fragment to a case. */
async function resolveCase(supabase: Supabase, ref: string): Promise<{ case?: CaseRow; candidates?: CaseRow[] }> {
  const { data } = await supabase
    .from('cases')
    .select('id, case_code, current_step_id, csr_id, assigned_to, clients(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(300)
  const rows = (data || []) as CaseRow[]
  const q = ref.trim().toLowerCase()

  const codeMatches = rows.filter(c => (c.case_code || '').toLowerCase() === q
    || (c.case_code || '').toLowerCase() === `c${q.padStart(6, '0')}`
    || (c.case_code || '').toLowerCase().endsWith(q.padStart(6, '0')))
  if (codeMatches.length === 1) return { case: codeMatches[0] }

  const nameMatches = rows.filter(c => clientName(c).toLowerCase().includes(q) && clientName(c))
  const all = codeMatches.length ? codeMatches : nameMatches
  if (all.length === 1) return { case: all[0] }
  if (all.length > 1) return { candidates: all.slice(0, 5) }
  return {}
}

const notFound = (ref: string) => ({ error: `No case matching "${ref}". Try the case code (e.g. C0000582) or the client's name.` })
const ambiguous = (rows: CaseRow[]) => ({
  error: 'Multiple cases match — be more specific',
  candidates: rows.map(c => `${c.case_code} — ${clientName(c)}`),
})

async function stepName(supabase: Supabase, stepId: string | null): Promise<string | null> {
  if (!stepId) return null
  const { data } = await supabase.from('case_steps').select('name').eq('id', stepId).single()
  return data?.name ?? null
}

async function notifyUsers(supabase: Supabase, fromUserId: string, userIds: (string | null)[], n: { kind: string; title: string; body: string; link: string; caseId: string }) {
  const targets = userIds.filter((id): id is string => !!id && id !== fromUserId)
  if (!targets.length) return
  await supabase.from('user_alerts').insert(
    targets.map(uid => ({
      user_id: uid,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      actor_id: fromUserId,
      case_id: n.caseId,
    }))
  )
}

export async function runTool(supabase: Supabase, me: BotUser, name: string, args: any): Promise<any> {
  switch (name) {
    case 'list_requests': {
      const { data } = await supabase
        .from('case_queries')
        .select('id, case_id, step_id, status, created_at, answered_at, opened_by, assigned_to, case_steps(name), cases(case_code, clients(first_name, last_name))')
        .or(`and(assigned_to.eq.${me.id},status.eq.open),and(opened_by.eq.${me.id},status.eq.answered,seen_at.is.null)`)
        .order('created_at', { ascending: false })
      const qids = (data || []).map((q: any) => q.id)
      const { data: entries } = qids.length
        ? await supabase.from('case_entries').select('query_id, body').in('query_id', qids).eq('request_part', 'question')
        : { data: [] }
      const questionByQuery = new Map((entries || []).map((e: any) => [e.query_id, e.body]))
      return {
        requests: (data || []).map((q: any) => ({
          id: q.id,
          case: `${q.cases?.case_code ?? ''} ${clientName(q.cases)}`.trim(),
          step: q.case_steps?.name ?? null,
          you_need_to: q.assigned_to === me.id && q.status === 'open' ? 'answer it' : 'mark it as seen',
          about: questionByQuery.get(q.id) ?? null,
          since: q.status === 'answered' ? q.answered_at : q.created_at,
        })),
      }
    }

    case 'list_actions': {
      const { data } = await supabase
        .from('case_entries')
        .select('id, body, due_date, created_at, cases(case_code, clients(first_name, last_name))')
        .eq('kind', 'action')
        .eq('created_by', me.id)
        .is('completed_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
      return {
        actions: (data || []).map((a: any) => ({
          id: a.id,
          what: a.body,
          due: a.due_date,
          case: a.cases ? `${a.cases.case_code ?? ''} ${clientName(a.cases)}`.trim() : null,
        })),
      }
    }

    case 'list_cases': {
      const { data } = await supabase
        .from('cases')
        .select('id, case_code, current_step_id, created_at, clients(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(15)
      const stepNames: Record<string, string> = {}
      for (const c of data || []) {
        if (c.current_step_id) stepNames[c.current_step_id] = await stepName(supabase, c.current_step_id) ?? ''
      }
      return {
        cases: (data || []).map((c: any) => ({
          code: c.case_code,
          client: clientName(c),
          current_step: stepNames[c.current_step_id] || null,
        })),
      }
    }

    case 'get_case': {
      const r = await resolveCase(supabase, args.case)
      if (r.candidates) return ambiguous(r.candidates)
      if (!r.case) return notFound(args.case)
      const c = r.case
      const { data: step } = await supabase.from('case_steps').select('name').eq('id', c.current_step_id).single()
      const { data: openQueries } = await supabase.from('case_queries').select('id, status, opened_by, assigned_to').eq('case_id', c.id).in('status', ['open', 'answered'])
      const { data: openActions } = await supabase.from('case_entries').select('id, body, due_date, created_by').eq('case_id', c.id).eq('kind', 'action').is('completed_at', null)
      return {
        case: { code: c.case_code, client: clientName(c), current_step: step?.name ?? null },
        live_requests: (openQueries || []).length,
        open_actions: (openActions || []).map((a: any) => `${a.body} (due ${a.due_date ?? 'no date'})`),
      }
    }

    case 'read_feed': {
      const r = await resolveCase(supabase, args.case)
      if (r.candidates) return ambiguous(r.candidates)
      if (!r.case) return notFound(args.case)
      const c = r.case
      const limit = Math.min(args.limit || 15, 30)
      const stepFilter = args.step ? String(args.step).toLowerCase() : null

      const { data: entries } = await supabase
        .from('case_entries')
        .select('id, step_id, kind, body, due_date, created_at, request_part, author:users!created_by(display_name, email)')
        .eq('case_id', c.id)
        .order('created_at', { ascending: false })
        .limit(60)
      const { data: steps } = await supabase.from('case_steps').select('id, name').eq('case_id', c.id).order('position')
      const stepById = new Map((steps || []).map((s: any) => [s.id, s.name]))

      const lines: string[] = []
      const wanted = (e: any) => !stepFilter || (stepById.get(e.step_id) || '').toLowerCase().includes(stepFilter)
      for (const e of (entries || []).filter(wanted)) {
        const who = (e.author as any)?.display_name || (e.author as any)?.email?.split('@')[0] || 'Someone'
        const day = new Date(e.created_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
        if (e.kind === 'action') {
          lines.push(`[${day}] ${who} set an action: ${e.body}${e.due_date ? ` (due ${e.due_date})` : ''}`)
        } else if (e.kind === 'system') {
          lines.push(`[${day}] ${who} ${e.body}`)
        } else {
          const tag = e.request_part ? ` (${e.request_part})` : ''
          lines.push(`[${day}] ${who}${tag}: ${e.body}`)
        }
        if (lines.length >= limit) break
      }
      return {
        case: `${c.case_code} — ${clientName(c)}`,
        step_names: (steps || []).map((s: any) => s.name),
        feed: lines,
        note: 'Newest first.',
      }
    }

    case 'send_message': {
      const r = await resolveCase(supabase, args.case)
      if (r.candidates) return ambiguous(r.candidates)
      if (!r.case) return notFound(args.case)
      const { error } = await supabase.from('case_entries').insert({
        case_id: r.case.id,
        step_id: r.case.current_step_id,
        kind: 'note',
        body: args.text.trim(),
        created_by: me.id,
      })
      return error ? { error: 'Failed to post message' } : { ok: `Posted to ${r.case.case_code} (${await stepName(supabase, r.case.current_step_id)})` }
    }

    case 'send_request': {
      const r = await resolveCase(supabase, args.case)
      if (r.candidates) return ambiguous(r.candidates)
      if (!r.case) return notFound(args.case)
      const c = r.case
      const isCsr = c.csr_id === me.id
      const target = isCsr ? c.assigned_to : c.csr_id
      if (!target) return { error: isCsr ? 'No lawyer assigned to this case yet' : 'No CSR assigned to this case' }

      const { data: live } = await supabase
        .from('case_queries').select('id, status')
        .eq('case_id', c.id).eq('step_id', c.current_step_id).eq('opened_by', me.id)
        .in('status', ['open', 'answered']).is('seen_at', null).limit(1)
      if (live?.length) return { error: live[0].status === 'answered' ? 'You already have an answer waiting — mark it seen first' : 'You already have an open request on this step' }

      const { data: entry } = await supabase.from('case_entries').insert({
        case_id: c.id, step_id: c.current_step_id, kind: 'note',
        body: args.text.trim(), created_by: me.id,
      }).select('id').single()

      const { data: query, error } = await supabase.from('case_queries').insert({
        case_id: c.id, step_id: c.current_step_id, opened_by: me.id,
        assigned_to: target, direction: isCsr ? 'csr_to_legal' : 'legal_to_csr', status: 'open',
      }).select('id').single()
      if (error || !query) return { error: 'Failed to send request' }
      if (entry) await supabase.from('case_entries').update({ query_id: query.id, request_part: 'question' }).eq('id', entry.id)

      await notifyUsers(supabase, me.id, [target], {
        kind: 'query',
        title: `New request on ${c.case_code}`,
        body: `${me.display_name || me.email.split('@')[0]} sent you a request`,
        link: `/cases/${c.id}/progress?s=${c.current_step_id}`,
        caseId: c.id,
      })
      return { ok: `Request sent on ${c.case_code}` }
    }

    case 'answer_request': {
      const r = await resolveCase(supabase, args.case)
      if (r.candidates) return ambiguous(r.candidates)
      if (!r.case) return notFound(args.case)
      const { data: q } = await supabase.from('case_queries').select('*')
        .eq('case_id', r.case.id).eq('assigned_to', me.id).eq('status', 'open')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!q) return { error: `No open request waiting for you on ${r.case.case_code}` }

      const { data: entry } = await supabase.from('case_entries').insert({
        case_id: r.case.id, step_id: q.step_id, kind: 'note',
        body: args.text.trim(), created_by: me.id,
      }).select('id').single()

      await supabase.from('case_queries').update({
        status: 'answered', answered_at: new Date().toISOString(), answered_by: me.id,
      }).eq('id', q.id)
      if (entry) await supabase.from('case_entries').update({ query_id: q.id, request_part: 'answer' }).eq('id', entry.id)

      await notifyUsers(supabase, me.id, [q.opened_by], {
        kind: 'query',
        title: `Request answered on ${r.case.case_code}`,
        body: `${me.display_name || me.email.split('@')[0]} answered your request`,
        link: `/cases/${r.case.id}/progress?s=${q.step_id}`,
        caseId: r.case.id,
      })
      return { ok: `Answer sent on ${r.case.case_code}` }
    }

    case 'mark_request_seen': {
      const r = await resolveCase(supabase, args.case)
      if (r.candidates) return ambiguous(r.candidates)
      if (!r.case) return notFound(args.case)
      const now = new Date().toISOString()
      const { data } = await supabase.from('case_queries').update({
        status: 'closed', seen_at: now, seen_by: me.id, closed_at: now,
      }).eq('case_id', r.case.id).eq('opened_by', me.id).eq('status', 'answered').is('seen_at', null).select('id')
      return data?.length ? { ok: 'Marked as seen' } : { error: 'No answered request waiting on that case' }
    }

    case 'cancel_request': {
      const r = await resolveCase(supabase, args.case)
      if (r.candidates) return ambiguous(r.candidates)
      if (!r.case) return notFound(args.case)
      const { data } = await supabase.from('case_queries')
        .update({ status: 'cancelled', closed_at: new Date().toISOString() })
        .eq('case_id', r.case.id).eq('opened_by', me.id).eq('status', 'open').select('id')
      return data?.length ? { ok: 'Request cancelled' } : { error: 'No open request of yours on that case' }
    }

    case 'set_action': {
      const r = await resolveCase(supabase, args.case)
      if (r.candidates) return ambiguous(r.candidates)
      if (!r.case) return notFound(args.case)
      if (!args.due_date) return { error: 'A due date is required (YYYY-MM-DD)' }
      const { error } = await supabase.from('case_entries').insert({
        case_id: r.case.id, step_id: r.case.current_step_id, kind: 'action',
        body: args.text.trim(), due_date: args.due_date, created_by: me.id,
      })
      return error ? { error: 'Failed to set action' } : { ok: `Action set on ${r.case.case_code} — "${args.text.trim()}" due ${args.due_date}` }
    }

    case 'complete_action': {
      let q = supabase.from('case_entries')
        .select('id, body, due_date, case_id, cases(case_code)')
        .eq('kind', 'action').eq('created_by', me.id).is('completed_at', null)
      if (args.case) {
        const r = await resolveCase(supabase, args.case)
        if (r.candidates) return ambiguous(r.candidates)
        if (!r.case) return notFound(args.case)
        q = q.eq('case_id', r.case.id)
      }
      const { data } = await q.order('due_date', { ascending: true })
      const rows = data || []
      if (!rows.length) return { error: 'No open actions found' }
      let match = rows
      if (args.text) {
        const needle = String(args.text).toLowerCase()
        match = rows.filter((a: any) => (a.body || '').toLowerCase().includes(needle))
      }
      if (match.length === 0) return { error: 'No action matches that', open_actions: rows.map((a: any) => a.body) }
      if (match.length > 1) return { error: 'Multiple actions match — be more specific', open_actions: match.map((a: any) => `${a.body} (${(a.cases as any)?.case_code})`) }
      const a = match[0] as any
      await supabase.from('case_entries').update({
        completed_at: new Date().toISOString(), completed_by: me.id,
      }).eq('id', a.id)
      return { ok: `Done — "${a.body}"` }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
