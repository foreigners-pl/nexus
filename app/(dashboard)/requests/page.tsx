import { RequestsContent } from '@/components/mobile/RequestsContent'

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams
  return <RequestsContent initialFilter={f} />
}
