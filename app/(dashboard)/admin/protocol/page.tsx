import { redirect } from 'next/navigation'

export default function ProtocolRedirectPage() {
  redirect('/admin/services')
}
