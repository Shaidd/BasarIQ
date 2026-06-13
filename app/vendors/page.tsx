import { createClient } from '@/lib/supabase/server'
import type { Region, Tables } from '@/supabase/types'

const REGIONS: { value: Region; label: string }[] = [
  { value: 'sharon', label: 'Sharon' },
  { value: 'haifa', label: 'Haifa' },
  { value: 'north', label: 'North' },
  { value: 'center', label: 'Center' },
  { value: 'jerusalem', label: 'Jerusalem' },
  { value: 'shfela', label: 'Shfela' },
  { value: 'south', label: 'South' },
]

const REGION_LABEL = Object.fromEntries(REGIONS.map(r => [r.value, r.label]))

type VendorRow = Pick<Tables<'vendors'>, 'id' | 'name' | 'city' | 'region' | 'type' | 'delivers' | 'rating'>

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: { region?: string }
}) {
  const supabase = await createClient()
  const region = searchParams.region as Region | undefined

  const baseQuery = supabase
    .from('vendors')
    .select('id, name, city, region, type, delivers, rating')
    .eq('status', 'active')
    .order('name')

  const { data } = region && REGION_LABEL[region]
    ? await baseQuery.eq('region', region)
    : await baseQuery

  const vendors = (data ?? []) as unknown as VendorRow[]

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendors</h1>
        <span className="text-sm text-gray-400">{vendors.length} vendors</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <a
          href="/vendors"
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !region ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
          }`}
        >
          All
        </a>
        {REGIONS.map(r => (
          <a
            key={r.value}
            href={`/vendors?region=${r.value}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              region === r.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {r.label}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {vendors.map(v => (
          <div key={v.id} className="bg-white border rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium leading-tight">{v.name}</div>
                <div className="text-sm text-gray-500">{v.city}</div>
              </div>
              {v.rating != null && (
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">★ {v.rating}</span>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5 capitalize">
                {v.type}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                {REGION_LABEL[v.region] ?? v.region}
              </span>
              {v.delivers && (
                <span className="text-xs bg-green-50 text-green-700 rounded px-2 py-0.5">
                  Delivers
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {vendors.length === 0 && (
        <p className="text-gray-400 text-center py-12">No vendors found</p>
      )}
    </main>
  )
}
