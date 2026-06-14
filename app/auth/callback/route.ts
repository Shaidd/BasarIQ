import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import type { Database } from '@/supabase/types'

type CookieItem = { name: string; value: string; options: CookieOptions }

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const invite = searchParams.get('invite')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: CookieItem[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && user) {
      // Mark invite as used if one was provided
      if (invite) {
        await supabase
          .from('invites')
          .update({ used_by: user.id, used_at: new Date().toISOString() })
          .eq('code', invite)
          .is('used_by', null) // idempotent — only updates if not already used
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_error`)
}
