'use client'

import { useState } from 'react'
import type { SourcingCandidate } from '@/lib/types'
import { FRESHNESS_LABELS } from '@/lib/types'

type Props = {
  candidates: SourcingCandidate[]
  onBack: () => void
}

export default function SourcingResults({ candidates, onBack }: Props) {
  // Top result expanded by default
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(candidates[0] ? [candidates[0].vendor_id] : []),
  )

  function toggleExpand(vendorId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(vendorId)) next.delete(vendorId)
      else next.add(vendorId)
      return next
    })
  }

  if (candidates.length === 0) {
    return (
      <div className="bg-white border rounded-xl p-10 text-center space-y-3">
        <p className="text-gray-600 font-medium">No vendors found</p>
        <p className="text-sm text-gray-400">
          No vendors in this area have sufficient stock for your list.
          <br />
          Try increasing the pickup radius or check delivery options.
        </p>
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
          ← Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          Results — {candidates.length} vendor{candidates.length !== 1 ? 's' : ''} found
        </h2>
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
      </div>

      <div className="space-y-3">
        {candidates.map((c, idx) => {
          const isTop = idx === 0
          const isExpanded = expandedIds.has(c.vendor_id)

          return (
            <div
              key={c.vendor_id}
              className={`rounded-xl border bg-white overflow-hidden ${
                isTop ? 'border-2 border-blue-500' : 'border'
              }`}
            >
              {/* Card header — click to expand/collapse */}
              <button
                onClick={() => toggleExpand(c.vendor_id)}
                className={`w-full text-left p-4 transition-colors ${
                  isTop ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{c.vendor_name}</span>
                      <span className="text-sm text-gray-500">{c.vendor_city}</span>
                      {isTop && (
                        <span className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 font-medium">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                      {c.pickup_or_delivery === 'pickup' ? (
                        <span>
                          {c.distance_km != null
                            ? `${c.distance_km.toFixed(1)} km away`
                            : 'Pickup'}
                        </span>
                      ) : (
                        <span>
                          Delivers ·{' '}
                          {c.delivery_fee != null && c.delivery_fee > 0
                            ? `+₪${c.delivery_fee} delivery`
                            : 'free delivery'}
                        </span>
                      )}
                      <span
                        className={`text-xs rounded px-2 py-0.5 ${
                          c.coverage_pct >= 1
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {Math.round(c.coverage_pct * 100)}% covered
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div>
                      <div className="text-xl font-bold text-gray-900">
                        ₪{c.total_ils.toFixed(0)}
                      </div>
                      {c.pickup_or_delivery === 'delivery' &&
                        c.delivery_fee != null &&
                        c.delivery_fee > 0 && (
                          <div className="text-xs text-gray-400">incl. delivery</div>
                        )}
                    </div>
                    <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {/* Expanded: per-cut breakdown */}
              {isExpanded && (
                <div className="border-t">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Cut</th>
                          <th className="px-4 py-2 text-right font-medium">Qty</th>
                          <th className="px-4 py-2 text-right font-medium">₪/kg</th>
                          <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                          <th className="px-4 py-2 text-center font-medium">Age</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {c.line_items.map(item => (
                          <tr key={item.cut_id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-gray-900">{item.cut_name_en}</div>
                              <div dir="rtl" className="text-xs text-gray-400">
                                {item.cut_name_he}
                              </div>
                            </td>

                            <td className="px-4 py-2.5 text-right text-gray-600 whitespace-nowrap">
                              {item.kg} kg
                            </td>

                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              {item.price_per_kg != null ? (
                                <span
                                  className={
                                    item.freshness === 'expired'
                                      ? 'line-through text-gray-400'
                                      : 'text-gray-700'
                                  }
                                >
                                  ₪{item.price_per_kg.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                              {item.is_penalized && (
                                <span
                                  title="Estimated — median × 1.15 used"
                                  className="ml-1 text-amber-500 text-xs"
                                >
                                  ⚠️
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                              {item.subtotal > 0 ? (
                                <span className="text-gray-900">₪{item.subtotal.toFixed(0)}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>

                            <td className="px-4 py-2.5 text-center">
                              {item.freshness ? FRESHNESS_LABELS[item.freshness] : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td colSpan={3} className="px-4 py-2.5 text-sm text-gray-600">
                            {c.pickup_or_delivery === 'delivery' &&
                            c.delivery_fee != null &&
                            c.delivery_fee > 0
                              ? `Items + ₪${c.delivery_fee} delivery fee`
                              : 'Total'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">
                            ₪{c.total_ils.toFixed(0)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Freshness legend */}
                  <div className="px-4 py-2 border-t bg-gray-50 flex gap-4 text-xs text-gray-400 flex-wrap">
                    <span>🟢 ≤ 7 days</span>
                    <span>🟡 8–21 days</span>
                    <span>🔴 expired (excluded from total, est. used)</span>
                    <span>⚠️ estimated price</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
