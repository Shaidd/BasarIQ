import { listInvites } from '@/app/actions/community'
import InviteManager from '@/components/InviteManager'

export default async function InvitesPage() {
  const result = await listInvites()

  if ('error' in result) {
    return <p className="text-red-600 text-sm">{result.error}</p>
  }

  return <InviteManager invites={result.invites} />
}
