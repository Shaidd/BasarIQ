import { listPendingExtractions } from '@/app/actions/extraction'
import ExtractionQueue from '@/components/ExtractionQueue'

export default async function ExtractionsPage() {
  const result = await listPendingExtractions()

  if ('error' in result) {
    return <p className="text-red-600 text-sm">{result.error}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Extraction review</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Prices held for review because they were outliers or had ambiguous units.
          Approved items become visible to all users.
        </p>
      </div>
      <ExtractionQueue items={result.items} />
    </div>
  )
}
