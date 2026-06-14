import { listUnresolvedFlags } from '@/app/actions/community'
import FlagQueue from '@/components/FlagQueue'

export default async function FlagsPage() {
  const result = await listUnresolvedFlags()

  if ('error' in result) {
    return <p className="text-red-600 text-sm">{result.error}</p>
  }

  return <FlagQueue flags={result.flags} />
}
