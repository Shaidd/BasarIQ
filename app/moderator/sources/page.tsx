import { listVendorSources } from '@/app/actions/extraction'
import { pauseVendorSource, resumeVendorSource } from '@/app/actions/extraction'
import { createClient } from '@/lib/supabase/server'
import AddSourceForm from '@/components/AddSourceForm'

function statusBadge(status: string, failCount: number) {
  if (status === 'broken') return <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">🔴 broken ({failCount} fails)</span>
  if (status === 'paused') return <span className="text-xs text-gray-600 bg-gray-100 border rounded px-2 py-0.5">⏸ paused</span>
  return <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">🟢 active</span>
}

function kindLabel(kind: string) {
  const map: Record<string, string> = { price_page: 'Price page', weekly_ad: 'Weekly ad', social: 'Social' }
  return map[kind] ?? kind
}

export default async function SourcesPage() {
  const [sourcesResult, supabase] = await Promise.all([
    listVendorSources(),
    createClient(),
  ])

  // Fetch active vendors for the add-source form
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name, city')
    .eq('status', 'active')
    .order('name')

  if ('error' in sourcesResult) {
    return <p className="text-red-600 text-sm">{sourcesResult.error}</p>
  }

  const sources = sourcesResult.sources

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Scrape sources</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            URLs scraped nightly for prices. Sources with 3+ consecutive failures are auto-paused.
          </p>
        </div>
        <AddSourceForm vendors={vendors ?? []} />
      </div>

      {sources.length === 0 && (
        <p className="text-gray-400 text-center py-12">No sources configured yet.</p>
      )}

      <div className="space-y-2">
        {sources.map(s => {
          const vendor = s.vendors as { name: string; city: string } | null
          const isActive = s.status === 'active'
          const isPaused = s.status === 'paused' || s.status === 'broken'

          return (
            <div key={s.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{vendor?.name ?? 'Unknown vendor'}</span>
                    {vendor?.city && <span className="text-sm text-gray-500">{vendor.city}</span>}
                    <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                      {kindLabel(s.kind)}
                    </span>
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate block"
                  >
                    {s.url}
                  </a>
                  <div className="flex items-center gap-3 flex-wrap">
                    {statusBadge(s.status, s.fail_count)}
                    {s.last_run_at && (
                      <span className="text-xs text-gray-400">
                        Last run: {new Date(s.last_run_at).toLocaleDateString('en-IL')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isActive && (
                    <form action={async () => { 'use server'; await pauseVendorSource(s.id) }}>
                      <button
                        type="submit"
                        className="text-xs px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Pause
                      </button>
                    </form>
                  )}
                  {isPaused && (
                    <form action={async () => { 'use server'; await resumeVendorSource(s.id) }}>
                      <button
                        type="submit"
                        className="text-xs px-3 py-1.5 border border-green-300 rounded-lg text-green-700 hover:bg-green-50 transition-colors"
                      >
                        Resume
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
