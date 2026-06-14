'use client'

import { useState, useTransition } from 'react'
import { createFlag } from '@/app/actions/community'

type Props = {
  observationId: string
  vendorName: string
  pricePerKg: number
  observedAt: string
  onClose: () => void
}

export default function FlagModal({ observationId, vendorName, pricePerKg, observedAt, onClose }: Props) {
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createFlag(observationId, reason)
      if ('error' in result) setError(result.error)
      else setDone(true)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        {done ? (
          <>
            <div className="text-center space-y-2">
              <div className="text-3xl">✅</div>
              <h2 className="font-semibold text-gray-900">Flag submitted</h2>
              <p className="text-sm text-gray-500">A moderator will review this observation.</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <div>
              <h2 className="font-semibold text-gray-900">Report observation</h2>
              <p className="text-sm text-gray-500 mt-1">
                {vendorName} · ₪{pricePerKg}/kg · {new Date(observedAt).toLocaleDateString()}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Describe the issue (e.g. price is wrong, vendor is closed)…"
                maxLength={500}
                rows={4}
                required
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="text-xs text-gray-400 text-right">{reason.length}/500</div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !reason.trim()}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {isPending ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
