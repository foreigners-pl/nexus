'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access'

/** The caller's admin capabilities — drives nav visibility and admin UI. */
export async function getMyAccess(): Promise<{
  canAdmin: boolean
  canSeeUsage: boolean
  canManage: boolean
  isManager: boolean
}> {
  const a = await getAccess()
  return {
    canAdmin: a?.canAdmin ?? false,
    canSeeUsage: a?.canSeeUsage ?? false,
    canManage: a?.canManage ?? false,
    isManager: a?.isManager ?? false,
  }
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: string | null
  roleId: string | null
  isManager: boolean
  managerId: string | null
}

/** Final boss only — the whole team plus every role, for management. */
export async function getTeamAccess(): Promise<{ members: TeamMember[]; roles: { id: string; name: string }[]; meId: string | null }> {
  const a = await getAccess()
  if (!a?.canManage) return { members: [], roles: [], meId: null }
  const admin = createAdminClient()
  const [usersRes, rolesRes] = await Promise.all([
    admin.from('users').select('id, display_name, email, is_manager, manager_id, role:roles(id, name)').order('display_name'),
    admin.from('roles').select('id, name').order('name'),
  ])
  return {
    members: (usersRes.data || []).map((u: any) => ({
      id: u.id,
      name: u.display_name || u.email,
      email: u.email,
      role: u.role?.name ?? null,
      roleId: u.role?.id ?? null,
      isManager: !!u.is_manager,
      managerId: u.manager_id ?? null,
    })),
    roles: rolesRes.data || [],
    meId: a.userId,
  }
}

/** Final boss only — set a member's role, manager flag, and manager. */
export async function updateUserAccess(
  userId: string,
  update: { roleId?: string | null; isManager?: boolean; managerId?: string | null },
): Promise<{ ok?: boolean; error?: string }> {
  const a = await getAccess()
  if (!a?.canManage) return { error: 'No access' }

  // Self-lockout guard: the caller can't strip their own final boss role.
  if (userId === a.userId && update.roleId !== undefined) {
    const admin = createAdminClient()
    const { data: r } = await admin.from('roles').select('name').eq('id', update.roleId).single()
    if (r?.name !== 'final boss') return { error: "You can't remove your own final boss role" }
  }

  const admin = createAdminClient()
  const patch: Record<string, any> = {}
  if (update.roleId !== undefined) patch.role = update.roleId
  if (update.isManager !== undefined) patch.is_manager = update.isManager
  if (update.managerId !== undefined) patch.manager_id = update.managerId
  if (!Object.keys(patch).length) return { error: 'Nothing to update' }

  // A member can only report to an actual manager — and never to themselves.
  if (update.managerId) {
    if (update.managerId === userId) return { error: "Can't report to yourself" }
    const { data: mgr } = await admin.from('users').select('id, is_manager, role:roles(name)').eq('id', update.managerId).single()
    if (!mgr || (!mgr.is_manager && (mgr.role as any)?.name !== 'manager'))
      return { error: 'That person is not a manager' }
  }

  const { error } = await admin.from('users').update(patch).eq('id', userId)
  return error ? { error: error.message } : { ok: true }
}
