'use client'

import { useState, useTransition } from 'react'
import { resolveFlag, type FlagWithObservation } from '@/app/actions/community'

type Props = {
  flags: FlagWithObservation[]
}

export default function FlagQueue({ flags: initialFlags }: Props) {
  const [flags, setFlags] = useState(initialFlags)
  const [resolutions, setResolutions] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  if (flags.length === 0) {
    return <p className="text-gray-500 text-sm">No unresolved flags. All clear.</p>
  }

  function handleResolve(flagId: string) {
    const resolution = resolutions[flagId] ?? ''
    startTransition(async () => {
      const result = await resolveFlag(flagId, resolution)
      if ('error' in result) {
        setErrors(prev => ({ ...prev, [flagId]: result.error }))
      } else {
        setFlags(prev => prev.filter(f => f.id !== flagId))
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{flags.length} unresolved flag{flags.length !== 1 ? 's' : ''}</p>
      <div className="space-y-3">
        {flags.map(f => {
          const obs = f.price_observations
          return (
            <div key={f.id} className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">🚩</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 text-sm">{f.reason}</div>
                  {obs && (
                    <div className="text-xs text-gray-500 mt-1">
                      Observation: ₪{obs.price_per_kg}/kg · {new Date(obs.observed_at).toLocaleDateString()}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">
                    Flagged {new Date(f.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 items-start">
                <textarea
                  value={resolutions[f.id] ?? ''}
                  onChange={e => setResolutions(prev => ({ ...prev, [f.id]: e.target.value }))}
                  placeholder="Resolution note (required)…"
                  rows={2}
                  className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={() => handleResolve(f.id)}
                  disabled={isPending || !(resolutions[f.id] ?? '').trim()}
                  className="shrink-0 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-3 py-2 font-medium transition-colors"
                >
                  Resolve
                </button>
              </div>

              {errors[f.id] && (
                <p className="text-xs text-red-600">{errors[f.id]}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
