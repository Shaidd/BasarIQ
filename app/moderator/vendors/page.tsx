import { listPendingVendors, approveVendor, rejectVendor } from '@/app/actions/community'

export default async function PendingVendorsPage() {
  const result = await listPendingVendors()

  if ('error' in result) {
    return <p className="text-red-600 text-sm">{result.error}</p>
  }

  const { vendors } = result

  if (vendors.length === 0) {
    return <p className="text-gray-500 text-sm">No pending vendor suggestions.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{vendors.length} pending vendor{vendors.length !== 1 ? 's' : ''}</p>
      <div className="bg-white border rounded-xl divide-y">
        {vendors.map(v => (
          <div key={v.id} className="flex items-start justify-between px-4 py-3 gap-4">
            <div className="min-w-0">
              <div className="font-medium text-gray-900">{v.name}</div>
              <div className="text-sm text-gray-600">{v.city} · {v.type} · {v.region}</div>
              {v.website && (
                <div className="text-xs text-gray-400 mt-0.5">{v.website}</div>
              )}
              <div className="text-xs text-gray-400 mt-0.5">
                Submitted {new Date(v.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <form action={async () => { 'use server'; await approveVendor(v.id) }}>
                <button
                  type="submit"
                  className="text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
                >
                  Approve
                </button>
              </form>
              <form action={async () => { 'use server'; await rejectVendor(v.id) }}>
                <button
                  type="submit"
                  className="text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg px-3 py-1.5 font-medium transition-colors"
                >
                  Reject
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
