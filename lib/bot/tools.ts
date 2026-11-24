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

      const dayAgo = Date.now() - 86400000
      const label = (q: any) => `${q.cases?.case_code ?? ''} ${clientName(q.cases)}`.trim()
      // Same buckets as the Requests page: waiting >24h counts as late.
      const to_answer = (data || [])
        .filter((q: any) => q.assigned_to === me.id && q.status === 'open')
        .map((q: any) => ({
          case: label(q), step: q.case_steps?.name ?? null,
          about: questionByQuery.get(q.id) ?? null,
          waiting_since: q.created_at,
          late: new Date(q.created_at).getTime() < dayAgo,
        }))
      const answered_awaiting_seen = (data || [])
        .filter((q: any) => q.opened_by === me.id && q.status === 'answered')
        .map((q: any) => ({
          case: label(q), step: q.case_steps?.name ?? null,
          about: questionByQuery.get(q.id) ?? null,
          answered_at: q.answered_at,
        }))

      // Board tasks assigned to me that aren't in a final status column.
      const { data: assigns } = await supabase.from('card_assignees').select('card_id').eq('user_id', me.id)
      let tasks: any[] = []
      if (assigns?.length) {
        const { data: cards } = await supabase
          .from('cards')
          .select('id, title, due_date, created_at, board_id, status_id, boards(name), board_statuses(name)')
          .in('id', assigns.map(a => a.card_id))
        const boardIds = [...new Set((cards || []).map((t: any) => t.board_id))]
        const { data: statuses } = boardIds.length
          ? await supabase.from('board_statuses').select('id, board_id, position').in('board_id', boardIds)
          : { data: [] }
        const maxPos = new Map<string, number>()
        for (const s of statuses || []) {
          const prev = maxPos.get(s.board_id)
          if (prev === undefined || (s.position ?? 0) > prev) maxPos.set(s.board_id, s.position ?? 0)
        }
        const finalIds = new Set((statuses || []).filter(s => (s.position ?? 0) === maxPos.get(s.board_id)).map(s => s.id))
        tasks = (cards || []).filter((t: any) => !finalIds.has(t.status_id)).map((t: any) => ({
          title: t.title, board: t.boards?.name ?? null, column: t.board_statuses?.name ?? null,
          due: t.due_date, late: new Date(t.created_at).getTime() < dayAgo,
        }))
      }
      return { to_answer, answered_awaiting_seen, tasks }
    }

    case 'list_actions': {
      const { data } = await supabase
        .from('case_entries')
        .select('id, body, due_date, waiting_on, created_at, cases(case_code, clients(first_name, last_name))')
        .eq('kind', 'action')
        .eq('created_by', me.id)
        .is('completed_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const label = (a: any) => a.cases ? `${a.cases.case_code ?? ''} ${clientName(a.cases)}`.trim() : null
      const row = (a: any) => ({ what: a.body, due: a.due_date, waiting_on: a.waiting_on ?? null, case: label(a) })
      const dated = (data || []).filter((a: any) => a.due_date)
      // Same buckets as the Actions page.
      const late = dated.filter((a: any) => new Date(a.due_date).getTime() < today.getTime()).map(row)
      const upcoming = dated.filter((a: any) => new Date(a.due_date).getTime() >= today.getTime()).map(row)
      const undated = (data || []).filter((a: any) => !a.due_date).map(row)

      // Neglected = my cases (CSR or legal, past presale, not completed) with
      // zero open actions — same definition the Actions page uses.
      const { data: myCases } = await supabase
        .from('cases')
        .select('id, case_code, status:status_id(name), step:case_steps!cases_current_step_id_fkey(name, step_type), clients(first_name, last_name)')
        .or(`assigned_to.eq.${me.id},csr_id.eq.${me.id}`)
      const eligible = (myCases || []).filter((c: any) =>
        c.step && c.step.step_type !== 'eligibility' && c.step.step_type !== 'presale' &&
        !(c.status?.name || '').toLowerCase().startsWith('complet'))
      let neglected: any[] = []
      if (eligible.length) {
        const { data: open } = await supabase.from('case_entries').select('case_id')
          .eq('kind', 'action').is('completed_at', null).in('case_id', eligible.map((c: any) => c.id))
        const has = new Set((open || []).map(r => r.case_id))
        neglected = eligible.filter((c: any) => !has.has(c.id))
          .map((c: any) => ({ case: `${c.case_code ?? ''} ${clientName(c)}`.trim(), step: c.step?.name ?? null }))
      }
      return { late, upcoming, undated, neglected_cases: neglected }
    }

    case 'list_notifications': {
      const { data } = await supabase
        .from('user_alerts')
        .select('id, kind, title, body, read_at, created_at, actor:users!actor_id(display_name, email)')
        .eq('user_id', me.id)
        .order('created_at', { ascending: false })
        .limit(15)
      const rows = data || []
      return {
        unread_count: rows.filter((n: any) => !n.read_at).length,
        notifications: rows.map((n: any) => ({
          kind: n.kind, title: n.title, body: n.body,
          from: n.actor?.display_name || n.actor?.email?.split('@')[0] || null,
          when: n.created_at, unread: !n.read_at,
        })),
        note: 'Only the 15 most recent. Notifications are informational — act on them via the other tools.',
      }
    }

    case 'mark_notifications_read': {
      await supabase.from('user_alerts')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', me.id).is('read_at', null)
      return { ok: 'All notifications marked as read' }
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

    case 'attach_files': {
      const r = await resolveCase(supabase, args.case)
      if (r.candidates) return ambiguous(r.candidates)
      if (!r.case) return notFound(args.case)
      const { data: pend } = await supabase
        .from('bot_pending_files').select('id, path, name, size, type')
        .eq('user_id', me.id)
      if (!pend?.length) return { error: 'No staged files — the user has not attached anything' }
      const targets = args.file
        ? pend.filter((p: any) => p.name.toLowerCase().includes(String(args.file).toLowerCase()))
        : pend
      if (!targets.length) return { error: `No staged file matching "${args.file}" — staged: ${pend.map((p: any) => p.name).join(', ')}` }

      const attached: string[] = []
      for (const p of targets as any[]) {
        const ext = p.name.split('.').pop()
        const newPath = `${r.case.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
        const { error: mvErr } = await supabase.storage.from('case_attachments').move(p.path, newPath)
        const { data: att } = await supabase.from('case_attachments').insert({
          case_id: r.case.id,
          file_name: p.name,
          file_path: mvErr ? p.path : newPath,
          file_size: p.size,
          file_type: p.type,
          uploaded_by: me.id,
        }).select('id').single()
        const { data: entry } = await supabase.from('case_entries').insert({
          case_id: r.case.id, step_id: r.case.current_step_id, kind: 'note',
          body: `Attached file: ${p.name}`, created_by: me.id,
        }).select('id').single()
        if (att?.id && entry?.id)
          await supabase.from('case_attachments').update({ entry_id: entry.id }).eq('id', att.id)
        await supabase.from('bot_pending_files').delete().eq('id', p.id)
        attached.push(p.name)
      }
      return { ok: `Attached ${attached.join(', ')} to ${r.case.case_code} ${clientName(r.case)}`.trim() }
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

    case 'find_client': {
      const q = `%${String(args.name || '').trim()}%`
      const { data } = await supabase
        .from('clients')
        .select('id, first_name, last_name, contact_email, contact_numbers(number)')
        .or(`first_name.ilike.${q},last_name.ilike.${q},contact_email.ilike.${q}`)
        .limit(8)
      if (!data?.length) return { error: `No client matching "${args.name}"` }
      const ids = data.map((c: any) => c.id)
      const { data: caseRows } = await supabase
        .from('cases').select('case_code, client_id').in('client_id', ids).order('created_at', { ascending: false })
      const casesByClient = new Map<string, string[]>()
      for (const r of caseRows || []) {
        casesByClient.set(r.client_id, [...(casesByClient.get(r.client_id) || []), r.case_code].filter(Boolean) as string[])
      }
      return {
        clients: data.map((c: any) => ({
          name: [c.first_name, c.last_name].filter(Boolean).join(' '),
          phones: (c.contact_numbers || []).map((p: any) => p.number).filter(Boolean),
          email: c.contact_email,
          cases: (casesByClient.get(c.id) || []).slice(0, 5),
        })),
      }
    }

    case 'create_client': {
      const parts = String(args.name || '').trim().split(/\s+/).filter(Boolean)
      if (!parts.length) return { error: 'Client name is required' }
      const { data: client, error } = await supabase.from('clients').insert({
        first_name: parts[0],
        last_name: parts.slice(1).join(' ') || null,
        contact_email: args.email ? String(args.email).trim() : null,
      }).select('id, first_name, last_name').single()
      if (error || !client) return { error: 'Failed to create client' }
      if (args.phone) {
        await supabase.from('contact_numbers').insert({
          client_id: client.id, number: String(args.phone).trim(), is_on_whatsapp: args.whatsapp !== false,
        })
      }
      return { ok: `Client created: ${[client.first_name, client.last_name].filter(Boolean).join(' ')}` }
    }

    case 'create_case': {
      // Resolve the client — word-wise match, then full-name containment.
      const words = String(args.client || '').trim().split(/\s+/).filter(Boolean)
      if (!words.length) return { error: 'Client name is required' }
      const orClause = words.flatMap(w => [`first_name.ilike.%${w}%`, `last_name.ilike.%${w}%`]).join(',')
      const { data: cands } = await supabase.from('clients').select('id, first_name, last_name').or(orClause).limit(20)
      const full = (c: any) => [c.first_name, c.last_name].filter(Boolean).join(' ')
      const needle = words.join(' ').toLowerCase()
      const exact = (cands || []).filter(c => full(c).toLowerCase().includes(needle))
      const pool = exact.length ? exact : (cands || [])
      if (!pool.length) return { error: `No client matching "${args.client}" — use create_client first` }
      if (pool.length > 1) return { error: 'Multiple clients match', candidates: pool.map(full) }
      const client = pool[0]

      // Service by name fragment — error lists what's available on a miss.
      let serviceId: string | null = null
      let serviceName: string | null = null
      if (args.service) {
        const { data: svcs } = await supabase.from('services').select('id, name').ilike('name', `%${String(args.service).trim()}%`).limit(8)
        if (!svcs?.length) {
          const { data: all } = await supabase.from('services').select('name').order('name').limit(30)
          return { error: `No service matching "${args.service}". Available: ${(all || []).map(s => s.name).join(', ')}` }
        }
        if (svcs.length > 1) return { error: 'Multiple services match', candidates: svcs.map(s => s.name) }
        serviceId = svcs[0].id
        serviceName = svcs[0].name
      }

      // Optional lawyer (assigned_to) by name/email fragment.
      let lawyerId: string | null = null
      let lawyerName: string | null = null
      if (args.lawyer) {
        const { data: us } = await supabase.from('users').select('id, display_name, email')
          .or(`display_name.ilike.%${String(args.lawyer).trim()}%,email.ilike.%${String(args.lawyer).trim()}%`).limit(8)
        const uName = (u: any) => u.display_name || u.email?.split('@')[0] || '?'
        if (!us?.length) return { error: `No user matching "${args.lawyer}"` }
        if (us.length > 1) return { error: 'Multiple users match', candidates: us.map(uName) }
        lawyerId = us[0].id
        lawyerName = uName(us[0])
      }

      const { data: newStatus } = await supabase.from('status').select('id').eq('name', 'New').single()
      const { data: created, error } = await supabase.from('cases').insert({
        client_id: client.id,
        status_id: newStatus?.id ?? null,
        assigned_to: lawyerId,
        csr_id: me.id,
      }).select('id, case_code').single()
      if (error || !created) return { error: 'Failed to create case' }

      // Same init as the app's addCase: assignee rows, system steps, initial step.
      for (const uid of [...new Set([me.id, lawyerId].filter(Boolean))] as string[]) {
        await supabase.from('case_assignees').insert({ case_id: created.id, user_id: uid })
      }
      await supabase.from('case_steps').insert([
        { case_id: created.id, name: 'Eligibility check', position: -3, is_required: true, step_type: 'eligibility' },
        { case_id: created.id, name: 'Pre-sale', position: -2, is_required: true, step_type: 'presale' },
        { case_id: created.id, name: 'Consultation', position: -1, is_required: false, step_type: 'consultation' },
        { case_id: created.id, name: 'Service closure', position: 1000000, is_required: true, step_type: 'closure' },
      ])
      const { data: elig } = await supabase.from('case_steps').select('id')
        .eq('case_id', created.id).eq('step_type', 'eligibility').single()
      if (elig) await supabase.from('cases').update({ current_step_id: elig.id }).eq('id', created.id)

      if (serviceId) {
        await supabase.from('case_services').insert({ case_id: created.id, service_id: serviceId })
        const { data: tpl } = await supabase.from('service_steps').select('name, position, is_required')
          .eq('service_id', serviceId).order('position')
        if (tpl?.length) {
          await supabase.from('case_steps').insert(tpl.map(t => ({
            case_id: created.id, name: t.name, position: t.position,
            is_required: t.is_required, step_type: 'service', service_id: serviceId,
          })))
        }
        await supabase.from('case_eligibility').insert([
          { case_id: created.id, service_id: serviceId, type: 'status' },
          { case_id: created.id, service_id: serviceId, type: 'documents' },
        ])
      }

      if (lawyerId) {
        await notifyUsers(supabase, me.id, [lawyerId], {
          kind: 'task',
          title: `New case ${created.case_code}`,
          body: `${me.display_name || me.email.split('@')[0]} assigned you to a case`,
          link: `/cases/${created.id}`,
          caseId: created.id,
        })
      }
      const bits = [`Created case ${created.case_code} for ${full(client)}`]
      if (serviceName) bits.push(`service: ${serviceName}`)
      if (lawyerName) bits.push(`lawyer: ${lawyerName}`)
      return { ok: bits.join(' — ') }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
