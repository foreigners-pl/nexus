'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Crown, Loader2, Check } from 'lucide-react'
import { getTeamAccess, updateUserAccess, type TeamMember } from '@/app/actions/access'

function MemberRow({
  member,
  roles,
  managers,
  onSaved,
}: {
  member: TeamMember
  roles: { id: string; name: string }[]
  managers: { id: string; name: string }[]
  onSaved: (id: string, patch: Partial<TeamMember>) => void
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function apply(patch: { roleId?: string | null; isManager?: boolean; managerId?: string | null }, local: Partial<TeamMember>) {
    setSaving(true)
    setErr(null)
    const res = await updateUserAccess(member.id, patch)
    setSaving(false)
    if (res.error) { setErr(res.error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onSaved(member.id, local)
  }

  const select =
    'bg-[hsl(var(--color-surface-hover))] border border-[hsl(var(--color-border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--color-text-primary))] focus:outline-none'

  return (
    <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))] truncate">
            {member.name}
          </p>
          <p className="text-[11px] text-[hsl(var(--color-text-secondary))] truncate">{member.email}</p>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--color-text-muted))] shrink-0" />}
        {saved && <Check className="w-4 h-4 text-green-400 shrink-0" />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--color-text-muted))]">Role</span>
          <select
            className={`${select} w-full mt-1`}
            value={member.roleId ?? ''}
            onChange={e => apply({ roleId: e.target.value || null }, { roleId: e.target.value || null, role: roles.find(r => r.id === e.target.value)?.name ?? null })}
          >
            <option value="">No role</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--color-text-muted))]">Manager</span>
          <button
            type="button"
            onClick={() => apply({ isManager: !member.isManager }, { isManager: !member.isManager })}
            className="w-full mt-1 flex items-center justify-between rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-hover))] px-2 py-1.5"
          >
            <span className="text-xs text-[hsl(var(--color-text-primary))]">{member.isManager ? 'Yes' : 'No'}</span>
            <span className={`w-8 h-[18px] rounded-full p-0.5 transition-colors ${member.isManager ? 'bg-[hsl(var(--color-primary))]' : 'bg-[hsl(var(--color-border))]'}`}>
              <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${member.isManager ? 'translate-x-[14px]' : ''}`} />
            </span>
          </button>
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--color-text-muted))]">Reports to</span>
          <select
            className={`${select} w-full mt-1`}
            value={member.managerId ?? ''}
            onChange={e => apply({ managerId: e.target.value || null }, { managerId: e.target.value || null })}
          >
            <option value="">Nobody</option>
            {managers.filter(m => m.id !== member.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      </div>

      {err && <p className="text-[11px] text-red-400 mt-2">{err}</p>}
    </div>
  )
}

export default function FinalBossPage() {
  const [data, setData] = useState<{ members: TeamMember[]; roles: { id: string; name: string }[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTeamAccess().then(res => {
      if (res.members.length || res.roles.length) setData({ members: res.members, roles: res.roles })
      setLoading(false)
    })
  }, [])

  function onSaved(id: string, patch: Partial<TeamMember>) {
    setData(d => d && {
      ...d,
      members: d.members.map(m => m.id === id ? { ...m, ...patch } : m),
    })
  }

  const managers = (data?.members || [])
    .filter(m => m.isManager || m.role === 'manager')
    .map(m => ({ id: m.id, name: m.name }))

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Admin
      </Link>
      <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-2 flex items-center gap-2">
        <Crown className="w-5 h-5 text-amber-400" /> Final boss
      </h1>
      <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-6">
        Set each member's role, whether they're a manager, and who they report to.
        Managers can mirror their reportees; compliance sees the usage overview.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--color-text-secondary))]" />
        </div>
      ) : !data ? (
        <p className="text-sm text-[hsl(var(--color-text-secondary))] py-10 text-center">
          You don't have access to this page.
        </p>
      ) : (
        <div className="space-y-2.5">
          {data.members.map(m => (
            <MemberRow key={m.id} member={m} roles={data.roles} managers={managers} onSaved={onSaved} />
          ))}
        </div>
      )}
    </div>
  )
}
