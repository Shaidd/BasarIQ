'use client'

import { useState, useTransition } from 'react'
import { addPriceObservation, type PriceResult } from '@/app/actions/price'

type Vendor = { id: string; name: string; city: string }

export default function PriceEntryForm({
  cutId,
  cutName,
  vendors,
}: {
  cutId: string
  cutName: string
  vendors: Vendor[]
}) {
  const [open, setOpen] = useState(false)
  const [vendorId, setVendorId] = useState('')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState<'per_kg' | 'per_100g'>('per_kg')
  const [isSale, setIsSale] = useState(false)
  const [saleEndsAt, setSaleEndsAt] = useState('')
  const [warning, setWarning] = useState<{ text: string; median: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const pricePerKg = unit === 'per_100g'
    ? parseFloat(price) * 10
    : parseFloat(price)

  function reset() {
    setVendorId('')
    setPrice('')
    setUnit('per_kg')
    setIsSale(false)
    setSaleEndsAt('')
    setWarning(null)
    setError(null)
    setSuccess(false)
  }

  function close() {
    setOpen(false)
    reset()
  }

  function submit(confirmed: boolean) {
    setError(null)
    startTransition(async () => {
      const result: PriceResult = await addPriceObservation({
        cutId,
        vendorId,
        pricePerKg,
        isSale,
        saleEndsAt: saleEndsAt || null,
        confirmed,
      })

      if ('warning' in result) {
        const direction = result.warningType === 'below' ? 'far below' : 'far above'
        setWarning({
          text: `₪${pricePerKg.toFixed(2)}/kg is ${direction} the regional median (₪${result.median.toFixed(2)}/kg). Are you sure this is correct?`,
          median: result.median,
        })
      } else if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(close, 1500)
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        + Add price
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={close}
    >
      <div
        className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Add price — {cutName}</h2>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        </div>

        {success ? (
          <div className="text-center py-6 space-y-2">
            <div className="text-3xl">✓</div>
            <div className="font-medium text-green-700">Price saved!</div>
          </div>
        ) : warning ? (
          <div className="space-y-4">
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {warning.text}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setWarning(null)}
                className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Go back
              </button>
              <button
                onClick={() => submit(true)}
                disabled={isPending}
                className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Submit anyway'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Vendor
              </label>
              <select
                value={vendorId}
                onChange={e => setVendorId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select vendor…</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Price
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">
                    ₪
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value as 'per_kg' | 'per_100g')}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="per_kg">per kg</option>
                  <option value="per_100g">per 100g</option>
                </select>
              </div>
              {unit === 'per_100g' && price && !isNaN(parseFloat(price)) && (
                <p className="text-xs text-gray-400">
                  = ₪{(parseFloat(price) * 10).toFixed(2)}/kg
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_sale"
                checked={isSale}
                onChange={e => setIsSale(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="is_sale" className="text-sm cursor-pointer">Sale price</label>
            </div>

            {isSale && (
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Sale ends
                </label>
                <input
                  type="date"
                  value={saleEndsAt}
                  onChange={e => setSaleEndsAt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <button
              onClick={() => submit(false)}
              disabled={isPending || !vendorId || !price || isNaN(pricePerKg)}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save price'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
