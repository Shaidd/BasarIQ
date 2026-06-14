'use client'

import { useRef, useState, useTransition } from 'react'
import type { ExtractionRow } from '@/lib/types/ocr'
import type { ConfirmedRow } from '@/app/actions/ocr'
import { saveOcrObservations } from '@/app/actions/ocr'
import type { Tables } from '@/supabase/types'

type VendorOption = Pick<Tables<'vendors'>, 'id' | 'name' | 'city' | 'region'>
type CutOption = Pick<Tables<'cuts'>, 'id' | 'name_en' | 'name_he'>

type OcrStep =
  | { type: 'select' }
  | { type: 'preview'; file: File; previewUrl: string }
  | { type: 'extracting' }
  | { type: 'confirm'; photoId: string; rows: ConfirmedRow[] }
  | { type: 'done'; saved: number }
  | { type: 'error'; message: string }

export default function OcrUploader({
  vendors,
  cuts,
}: {
  vendors: VendorOption[]
  cuts: CutOption[]
}) {
  const [vendorId, setVendorId] = useState('')
  const [step, setStep] = useState<OcrStep>({ type: 'select' })
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!vendorId) {
      alert('Please select a vendor first.')
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setStep({ type: 'preview', file, previewUrl })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function runExtraction(file: File) {
    setStep({ type: 'extracting' })

    const body = new FormData()
    body.append('image', file)
    body.append('vendorId', vendorId)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body })
      const json = await res.json()

      if (!res.ok || json.error) {
        setStep({ type: 'error', message: json.error ?? 'Extraction failed' })
        return
      }

      const rows: ConfirmedRow[] = (json.rows as ExtractionRow[]).map(r => ({
        ...r,
        cut_id: r.matched_cut_id ?? '',
        include: true,
      }))

      setStep({ type: 'confirm', photoId: json.photoId, rows })
    } catch (e) {
      setStep({ type: 'error', message: 'Network error — please try again' })
    }
  }

  function updateRow(idx: number, patch: Partial<ConfirmedRow>) {
    if (step.type !== 'confirm') return
    const rows = step.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    setStep({ ...step, rows })
  }

  function handleSave() {
    if (step.type !== 'confirm') return
    const { photoId, rows } = step
    startTransition(async () => {
      const result = await saveOcrObservations(vendorId, photoId, rows)
      if ('error' in result) {
        setStep({ type: 'error', message: result.error })
      } else {
        setStep({ type: 'done', saved: result.saved })
      }
    })
  }

  function reset() {
    setStep({ type: 'select' })
    setVendorId('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const selectedVendor = vendors.find(v => v.id === vendorId)

  return (
    <div className="space-y-6">
      {/* Vendor selector — locked once extraction starts */}
      {(step.type === 'select' || step.type === 'preview') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={vendorId}
            onChange={e => setVendorId(e.target.value)}
          >
            <option value="">Select a vendor…</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.city}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Step: select */}
      {step.type === 'select' && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center space-y-4 bg-white">
          <p className="text-gray-500 text-sm">
            Take a photo or upload an image of a price tag or shelf label
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={!vendorId}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              📷 Camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!vendorId}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Upload image
            </button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Step: preview */}
      {step.type === 'preview' && (
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.previewUrl}
              alt="Preview"
              className="w-full max-h-96 object-contain"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => runExtraction(step.file)}
              className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Extract prices
            </button>
            <button
              onClick={reset}
              className="px-5 py-2.5 border text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step: extracting */}
      {step.type === 'extracting' && (
        <div className="text-center py-16 space-y-3">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Analyzing image with Claude…</p>
        </div>
      )}

      {/* Step: confirm */}
      {step.type === 'confirm' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Confirm extracted prices</h2>
              <p className="text-sm text-gray-500">
                Vendor: {selectedVendor?.name} — {selectedVendor?.city}
              </p>
            </div>
            <span className="text-xs text-gray-400">{step.rows.length} item{step.rows.length !== 1 ? 's' : ''} found</span>
          </div>

          {step.rows.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No prices detected in this image.
            </div>
          ) : (
            <div className="space-y-3">
              {step.rows.map((row, idx) => (
                <div
                  key={idx}
                  className={`bg-white border rounded-xl p-4 space-y-3 ${
                    !row.include ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={e => updateRow(idx, { include: e.target.checked })}
                        className="shrink-0 mt-0.5 accent-blue-600"
                      />
                      <p className="text-sm text-gray-500 truncate" dir="auto">
                        {row.raw_text}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {row.needs_review && (
                        <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-2 py-0.5">
                          Review
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {Math.round(row.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  {row.include && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Cut picker */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-gray-500 mb-0.5">Cut</label>
                        <select
                          className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          value={row.cut_id}
                          onChange={e => updateRow(idx, { cut_id: e.target.value })}
                        >
                          <option value="">— pick cut —</option>
                          {cuts.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name_en} / {c.name_he}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Price */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">
                          Price (₪/{row.unit === 'per_100g' ? '100g' : row.unit === 'per_unit' ? 'unit' : 'kg'})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.price ?? ''}
                          onChange={e =>
                            updateRow(idx, {
                              price: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={
                isPending ||
                step.rows.filter(r => r.include).every(r => !r.cut_id || r.price === null)
              }
              className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Saving…' : 'Save prices'}
            </button>
            <button
              onClick={reset}
              disabled={isPending}
              className="px-5 py-2.5 border text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step: done */}
      {step.type === 'done' && (
        <div className="text-center py-12 space-y-3">
          <div className="text-4xl">✓</div>
          <p className="font-medium text-gray-900">
            {step.saved} price{step.saved !== 1 ? 's' : ''} saved
          </p>
          <button
            onClick={reset}
            className="text-sm text-blue-600 hover:underline"
          >
            Log another photo
          </button>
        </div>
      )}

      {/* Step: error */}
      {step.type === 'error' && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
          <p className="text-sm text-red-700">{step.message}</p>
          <button
            onClick={reset}
            className="text-sm text-red-700 underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
