'use client'

import { useState, useTransition } from 'react'
import { generateInvite } from '@/app/actions/community'
import type { Tables } from '@/supabase/types'

type Props = {
  invites: Tables<'invites'>[]
}

export default function InviteManager({ invites: initialInvites }: Props) {
  const [invites, setInvites] = useState(initialInvites)
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const result = await generateInvite()
      if ('error' in result) {
        setError(result.error)
      } else {
        setInvites(prev => [{
          id: crypto.randomUUID(),
          code: result.code,
          created_by: '',
          used_by: null,
          expires_at: result.expires_at,
          used_at: null,
          created_at: new Date().toISOString(),
        }, ...prev])
      }
    })
  }

  function handleCopy(code: string) {
    const url = `${window.location.origin}/auth/login?invite=${code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  function inviteStatus(invite: Tables<'invites'>): 'used' | 'expired' | 'active' {
    if (invite.used_by) return 'used'
    if (new Date(invite.expires_at) < new Date()) return 'expired'
    return 'active'
  }

  const statusStyle = {
    active: 'bg-green-50 text-green-700',
    used: 'bg-gray-100 text-gray-500',
    expired: 'bg-red-50 text-red-600',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{invites.length} invite{invites.length !== 1 ? 's' : ''} total</p>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 font-medium transition-colors"
        >
          {isPending ? 'Generating…' : 'Generate invite'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {invites.length === 0 ? (
        <p className="text-gray-400 text-sm">No invites yet. Generate one to get started.</p>
      ) : (
        <div className="bg-white border rounded-xl divide-y">
          {invites.map(invite => {
            const status = inviteStatus(invite)
            return (
              <div key={invite.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm font-semibold text-gray-900">{invite.code}</code>
                    <span className={`text-xs rounded px-2 py-0.5 font-medium ${statusStyle[status]}`}>
                      {status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Expires {new Date(invite.expires_at).toLocaleDateString()}
                    {invite.used_at && ` · Used ${new Date(invite.used_at).toLocaleDateString()}`}
                  </div>
                </div>
                {status === 'active' && (
                  <button
                    onClick={() => handleCopy(invite.code)}
                    className="shrink-0 text-sm border rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {copiedCode === invite.code ? 'Copied!' : 'Copy link'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
