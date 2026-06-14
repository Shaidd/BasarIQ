'use client'

import { useState, useTransition } from 'react'
import { suggestVendor } from '@/app/actions/community'
import type { Region, VendorType } from '@/supabase/types'

const REGIONS: { value: Region; label: string }[] = [
  { value: 'north', label: 'North' },
  { value: 'haifa', label: 'Haifa' },
  { value: 'sharon', label: 'Sharon' },
  { value: 'center', label: 'Center' },
  { value: 'jerusalem', label: 'Jerusalem' },
  { value: 'shfela', label: 'Shfela' },
  { value: 'south', label: 'South' },
]

const VENDOR_TYPES: { value: VendorType; label: string }[] = [
  { value: 'butcher', label: 'Butcher' },
  { value: 'chain', label: 'Chain' },
  { value: 'market', label: 'Market' },
  { value: 'online', label: 'Online' },
  { value: 'farm', label: 'Farm' },
]

export default function VendorSuggestionForm() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [type, setType] = useState<VendorType>('butcher')
  const [region, setRegion] = useState<Region>('center')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')

  function reset() {
    setName(''); setCity(''); setType('butcher'); setRegion('center')
    setWebsite(''); setPhone(''); setError(null); setDone(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await suggestVendor({
        name, city, type, region,
        website: website.trim() || null,
        phone: phone.trim() || null,
      })
      if ('error' in result) setError(result.error)
      else setDone(true)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 hover:underline"
      >
        + Suggest a vendor
      </button>
    )
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-medium text-green-800">Thanks! Your suggestion has been submitted for review.</p>
        <button
          onClick={() => { reset(); setOpen(false) }}
          className="text-xs text-green-700 underline"
        >
          Submit another
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 text-sm">Suggest a vendor</h3>
        <button onClick={() => { setOpen(false); reset() }} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vendor name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">City *</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as VendorType)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {VENDOR_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Region</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value as Region)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Website (optional)</label>
            <input
              type="url"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone (optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
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
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isPending ? 'Submitting…' : 'Submit suggestion'}
          </button>
        </div>
      </form>
    </div>
  )
}
