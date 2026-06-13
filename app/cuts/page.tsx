import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/supabase/types'

const PRIMAL_LABEL: Record<string, string> = {
  chuck: 'Chuck', rib: 'Rib', brisket: 'Brisket', loin: 'Loin',
  round: 'Round', plate: 'Plate', flank: 'Flank', shank: 'Shank', other: 'Other',
}

type CutRow = Pick<Tables<'cuts'>, 'id' | 'name_en' | 'name_he' | 'primal' | 'israeli_number'>

export default async function CutsPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const supabase = await createClient()
  const q = searchParams.q?.trim() ?? ''

  const baseQuery = supabase
    .from('cuts')
    .select('id, name_en, name_he, primal, israeli_number')
    .eq('status', 'active')
    .order('name_en')

  const { data } = q
    ? await baseQuery.or(`name_en.ilike.%${q}%,name_he.ilike.%${q}%`)
    : await baseQuery

  const cuts = (data ?? []) as unknown as CutRow[]

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Beef cuts</h1>
        <span className="text-sm text-gray-400">{cuts.length} cuts</span>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or Hebrew…"
          dir="auto"
          className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
        {q && (
          <a href="/cuts" className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors">
            Clear
          </a>
        )}
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {cuts.map(cut => (
          <Link
            key={cut.id}
            href={`/cuts/${cut.id}`}
            className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow space-y-1"
          >
            <div className="font-medium text-gray-900">{cut.name_en}</div>
            <div className="text-sm text-gray-600" dir="rtl">{cut.name_he}</div>
            <div className="flex items-center gap-2 mt-2">
              {cut.primal && (
                <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                  {PRIMAL_LABEL[cut.primal] ?? cut.primal}
                </span>
              )}
              {cut.israeli_number && (
                <span className="text-xs text-gray-400">#{cut.israeli_number}</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {cuts.length === 0 && (
        <p className="text-gray-400 text-center py-12">
          No cuts found{q ? ` for "${q}"` : ''}
        </p>
      )}
    </main>
  )
}
