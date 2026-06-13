import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PriceHistoryChart, { type ChartPoint } from '@/components/PriceHistoryChart'
import PriceEntryForm from '@/components/PriceEntryForm'
import { observationFreshness, type ObservationSource } from '@/lib/aliases'
import type { Tables } from '@/supabase/types'

const FRESHNESS_BADGE = { fresh: '🟢', stale: '🟡', expired: '🔴' } as const
const PRIMAL_LABEL: Record<string, string> = {
  chuck: 'Chuck', rib: 'Rib', brisket: 'Brisket', loin: 'Loin',
  round: 'Round', plate: 'Plate', flank: 'Flank', shank: 'Shank', other: 'Other',
}

type ObsRow = Tables<'price_observations'> & {
  vendor: { name: string; region: string } | null
}

type VendorRow = Pick<Tables<'vendors'>, 'id' | 'name' | 'city'>

export default async function CutPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [{ data: cutRaw }, { data: obsRaw }, { data: vendorsRaw }] = await Promise.all([
    supabase
      .from('cuts')
      .select('*')
      .eq('id', params.id)
      .eq('status', 'active')
      .single(),
    supabase
      .from('price_observations')
      .select('*, vendor:vendors(name, region)')
      .eq('cut_id', params.id)
      .eq('status', 'active')
      .gte('observed_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('observed_at', { ascending: false }),
    supabase
      .from('vendors')
      .select('id, name, city')
      .eq('status', 'active')
      .order('name'),
  ])

  const cut = cutRaw as unknown as Tables<'cuts'> | null
  if (!cut) notFound()

  const obs = (obsRaw ?? []) as unknown as ObsRow[]
  const vendors = (vendorsRaw ?? []) as unknown as VendorRow[]

  function freshness(o: ObsRow) {
    return observationFreshness(
      o.source as ObservationSource,
      new Date(o.observed_at),
      o.is_sale,
      o.sale_ends_at ? new Date(o.sale_ends_at) : null,
    )
  }

  const chartData: ChartPoint[] = obs.map(o => ({
    date: o.observed_at,
    price: o.price_per_kg,
    vendor: o.vendor?.name ?? 'Unknown',
    freshness: freshness(o),
  }))

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{cut.name_en}</h1>
            <p className="text-lg text-gray-600 mt-0.5" dir="rtl">{cut.name_he}</p>
          </div>
          <PriceEntryForm
            cutId={cut.id}
            cutName={cut.name_en}
            vendors={vendors}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {cut.primal && (
            <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
              {PRIMAL_LABEL[cut.primal] ?? cut.primal}
            </span>
          )}
          {cut.israeli_number && (
            <span className="text-xs text-gray-400">Israeli #{cut.israeli_number}</span>
          )}
        </div>
        {cut.kosher_notes && (
          <p className="text-xs text-gray-400 italic">{cut.kosher_notes}</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Price history (last 90 days)</h2>
        <PriceHistoryChart data={chartData} />
      </div>

      {obs.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Recent prices</h2>
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Vendor</th>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Price/kg</th>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Date</th>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {obs.map(o => {
                  const f = freshness(o)
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{o.vendor?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        ₪{o.price_per_kg.toFixed(2)}
                        {o.is_sale && (
                          <span className="ml-1.5 text-xs bg-orange-50 text-orange-600 rounded px-1.5 py-0.5">
                            sale
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(o.observed_at).toLocaleDateString('en-IL', {
                          day: 'numeric', month: 'short', year: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3" title={f}>{FRESHNESS_BADGE[f]}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
