'use client'

import { useState, useTransition } from 'react'
import { addVendorSource } from '@/app/actions/extraction'
import type { VendorSourceKind, Tables } from '@/supabase/types'

type VendorOption = Pick<Tables<'vendors'>, 'id' | 'name' | 'city'>

const KIND_OPTIONS: { value: VendorSourceKind; label: string }[] = [
  { value: 'price_page', label: 'Price page' },
  { value: 'weekly_ad', label: 'Weekly ad' },
  { value: 'social', label: 'Social / flyer' },
]

export default function AddSourceForm({ vendors }: { vendors: VendorOption[] }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<VendorSourceKind>('price_page')

  function reset() {
    setUrl(''); setKind('price_page'); setError(null); setDone(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await addVendorSource(vendorId, url, kind)
      if ('error' in result) setError(result.error)
      else { setDone(true); setTimeout(() => { reset(); setOpen(false) }, 1500) }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 hover:underline"
      >
        + Add source
      </button>
    )
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
        Source added successfully.
      </div>
    )
  }

  return (
    <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 text-sm">Add scrape source</h3>
        <button onClick={() => { setOpen(false); reset() }} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vendor *</label>
          <select
            value={vendorId}
            onChange={e => setVendorId(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">URL *</label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://…"
            required
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Kind</label>
          <select
            value={kind}
            onChange={e => setKind(e.target.value as VendorSourceKind)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {KIND_OPTIONS.map(k => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setOpen(false); reset() }}
            className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !url.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isPending ? 'Adding…' : 'Add source'}
          </button>
        </div>
      </form>
    </div>
  )
}
