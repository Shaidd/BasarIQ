'use client'

import { useState, useEffect, useTransition, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateInviteCode } from '@/app/actions/community'

function LoginForm() {
  const searchParams = useSearchParams()
  const urlInvite = searchParams.get('invite') ?? ''

  // Step 1: validate invite code. If URL has one, skip straight to auth step.
  const [step, setStep] = useState<'invite' | 'auth'>(urlInvite ? 'auth' : 'invite')
  const [inviteCode, setInviteCode] = useState(urlInvite)
  const [inviteInput, setInviteInput] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isValidating, startValidating] = useTransition()

  // Step 2: auth
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const supabase = createClient()

  // If URL contains an invite code, silently validate it in the background
  useEffect(() => {
    if (!urlInvite) return
    startValidating(async () => {
      const result = await validateInviteCode(urlInvite)
      if ('error' in result) {
        setInviteCode('')
        setStep('invite')
        setInviteError(result.error)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInvite])

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    startValidating(async () => {
      const result = await validateInviteCode(inviteInput.trim())
      if ('error' in result) {
        setInviteError(result.error)
      } else {
        setInviteCode(inviteInput.trim())
        setStep('auth')
      }
    })
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setAuthError(null)
    const redirectTo = inviteCode
      ? `${window.location.origin}/auth/callback?invite=${inviteCode}`
      : `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    if (error) setAuthError(error.message)
    else setSent(true)
    setLoading(false)
  }

  async function handleGoogle() {
    const redirectTo = inviteCode
      ? `${window.location.origin}/auth/callback?invite=${inviteCode}`
      : `${window.location.origin}/auth/callback`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3 p-6">
          <div className="text-4xl">📧</div>
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-gray-500 text-sm">
            Magic link sent to <strong>{email}</strong>
          </p>
          <button onClick={() => setSent(false)} className="text-sm text-blue-600 underline">
            Use a different email
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 bg-white p-8 rounded-xl shadow-sm border">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">BasarIQ</h1>
          <p className="text-gray-500 text-sm mt-1">Israel beef price intelligence</p>
        </div>

        {step === 'invite' && (
          <>
            {inviteError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {inviteError}
              </div>
            )}
            <form onSubmit={handleInviteSubmit} className="space-y-3">
              <p className="text-sm text-gray-600">BasarIQ is invite-only. Enter your invite code to continue.</p>
              <input
                type="text"
                value={inviteInput}
                onChange={e => setInviteInput(e.target.value)}
                placeholder="Your invite code"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
              />
              <button
                type="submit"
                disabled={isValidating || !inviteInput.trim()}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isValidating ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'auth' && (
          <>
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span>✓</span>
              <span>Invite code accepted{inviteCode ? ` (${inviteCode})` : ''}</span>
              {!urlInvite && (
                <button
                  onClick={() => setStep('invite')}
                  className="ml-auto text-gray-400 hover:text-gray-600 text-xs underline"
                >
                  Change
                </button>
              )}
            </div>

            {authError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {authError}
              </div>
            )}

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-wide">or</span>
              </div>
            </div>

            <button
              onClick={handleGoogle}
              className="w-full py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
