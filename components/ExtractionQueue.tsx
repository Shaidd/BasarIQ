'use client'

import { useState, useTransition } from 'react'
import { approveExtraction, rejectExtraction } from '@/app/actions/extraction'
import type { ObservationForReview } from '@/app/actions/extraction'

function confidenceBadge(confidence: number | null) {
  if (confidence === null) return null
  if (confidence >= 0.9) return <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">🟢 {Math.round(confidence * 100)}%</span>
  if (confidence >= 0.7) return <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5">🟡 {Math.round(confidence * 100)}%</span>
  return <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">🔴 {Math.round(confidence * 100)}%</span>
}

export default function ExtractionQueue({ items: initial }: { items: ObservationForReview[] }) {
  const [items, setItems] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveExtraction(id)
      if ('error' in result) {
        setErrors(prev => ({ ...prev, [id]: result.error }))
      } else {
        removeItem(id)
      }
    })
  }

  function handleReject(id: string) {
    startTransition(async () => {
      const result = await rejectExtraction(id)
      if ('error' in result) {
        setErrors(prev => ({ ...prev, [id]: result.error }))
      } else {
        removeItem(id)
      }
    })
  }

  if (items.length === 0) {
    return (
      <p className="text-gray-400 text-center py-12">No pending extractions — all caught up.</p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''} awaiting review</p>
      {items.map(item => {
        const cut = item.cuts as { name_en: string; name_he: string } | null
        const vendor = item.vendors as { name: string; region: string } | null
        const sourceHostname = item.source_url ? (() => { try { return new URL(item.source_url).hostname } catch { return item.source_url } })() : null

        return (
          <div key={item.id} className="bg-white border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <div className="font-medium text-gray-900">
                  {cut ? `${cut.name_en} / ${cut.name_he}` : 'Unknown cut'}
                </div>
                <div className="text-sm text-gray-500">
                  {vendor?.name ?? 'Unknown vendor'}
                  {vendor?.region && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 capitalize">
                      {vendor.region}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <div className="text-lg font-bold text-gray-900">
                  ₪{item.price_per_kg.toFixed(2)}/kg
                </div>
                {confidenceBadge(item.confidence)}
              </div>
            </div>

            {item.source_url && (
              <div className="text-xs text-gray-400 truncate">
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 hover:underline"
                >
                  {sourceHostname}
                </a>
              </div>
            )}

            {item.raw_text && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 font-mono truncate">
                {item.raw_text}
              </div>
            )}

            {errors[item.id] && (
              <p className="text-xs text-red-600">{errors[item.id]}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(item.id)}
                disabled={isPending}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(item.id)}
                disabled={isPending}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
