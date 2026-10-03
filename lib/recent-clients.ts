// Recently viewed clients, stored per-browser for the mobile home screen

export interface RecentClient {
  id: string
  name: string
  phone?: string | null
  viewed_at: number
}

const STORAGE_KEY = 'recent-clients'
const MAX_ITEMS = 10

export function addRecentClient(client: { id: string; name: string; phone?: string | null }) {
  if (typeof window === 'undefined') return

  try {
    const existing = getRecentClients().filter(c => c.id !== client.id)
    const next: RecentClient[] = [
      { ...client, viewed_at: Date.now() },
      ...existing,
    ].slice(0, MAX_ITEMS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage unavailable - ignore
  }
}

export function getRecentClients(): RecentClient[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
