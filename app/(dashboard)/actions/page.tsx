import { ActionsContent } from '@/components/mobile/ActionsContent'

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams
  return <ActionsContent initialFilter={f} />
}
