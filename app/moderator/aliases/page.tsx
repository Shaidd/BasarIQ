import { listAliasSuggestions, promoteAliasSuggestion } from '@/app/actions/community'

export default async function AliasesPage() {
  const result = await listAliasSuggestions()

  if ('error' in result) {
    return <p className="text-red-600 text-sm">{result.error}</p>
  }

  const { suggestions } = result

  if (suggestions.length === 0) {
    return <p className="text-gray-500 text-sm">No pending alias suggestions.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{suggestions.length} pending suggestion{suggestions.length !== 1 ? 's' : ''}</p>
      <div className="bg-white border rounded-xl divide-y">
        {suggestions.map(s => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-4">
            <div className="min-w-0">
              <div className="font-medium text-gray-900">{s.suggested_alias}</div>
              <div className="text-sm text-gray-500">
                {s.cuts ? `${s.cuts.name_en} / ${s.cuts.name_he}` : s.cut_id}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Suggested by {s.suggested_by} · {new Date(s.created_at).toLocaleDateString()}
              </div>
            </div>
            <form action={async () => { 'use server'; await promoteAliasSuggestion(s.id) }}>
              <button
                type="submit"
                className="shrink-0 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
              >
                Promote
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
