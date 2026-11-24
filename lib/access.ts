import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Admin capability model.
 *
 *  final boss — everything: usage overview, mirroring anyone, the
 *               Final boss page (roles + hierarchy management).
 *  compliance — usage overview only.
 *  manager    — usage page filtered to their reportees, mirroring
 *               only those reportees. A manager is anyone with
 *               is_manager or the 'manager' role.
 *  legal/csr/other — no admin surface at all.
 */
export interface Access {
  userId: string
  name: string
  role: string | null
  isManager: boolean
  reporteeIds: string[]
  canAdmin: boolean
  canSeeUsage: boolean
  canManage: boolean
}

export async function getAccess(): Promise<Access | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: u } = await admin
    .from('users')
    .select('id, display_name, email, is_manager, role:roles(name)')
    .eq('id', user.id)
    .single()
  if (!u) return null

  const role = (u.role as any)?.name ?? null
  const isManager = !!u.is_manager || role === 'manager'
  const canManage = role === 'final boss'
  const canSeeUsage = canManage || role === 'compliance' || isManager

  const { data: reps } = isManager
    ? await admin.from('users').select('id').eq('manager_id', u.id)
    : { data: [] }

  return {
    userId: u.id,
    name: u.display_name || u.email,
    role,
    isManager,
    reporteeIds: (reps || []).map((r: any) => r.id),
    canAdmin: canSeeUsage || canManage,
    canSeeUsage,
    canManage,
  }
}

/** Can this caller mirror `targetId`? Final boss → anyone; manager → own
 *  reportees only; everyone else → nobody. */
export function canMirror(access: Access, targetId: string): boolean {
  return access.canManage || access.reporteeIds.includes(targetId)
}
