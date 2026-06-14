import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: role } = await supabase.rpc('get_user_role')
  if (role !== 'moderator') redirect('/')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Moderator</h1>
        <nav className="flex gap-4 mt-2 text-sm text-gray-500">
          <Link href="/moderator" className="hover:text-gray-900 transition-colors">Dashboard</Link>
          <Link href="/moderator/flags" className="hover:text-gray-900 transition-colors">Flags</Link>
          <Link href="/moderator/invites" className="hover:text-gray-900 transition-colors">Invites</Link>
          <Link href="/moderator/vendors" className="hover:text-gray-900 transition-colors">Vendors</Link>
          <Link href="/moderator/aliases" className="hover:text-gray-900 transition-colors">Aliases</Link>
        </nav>
      </div>
      {children}
    </div>
  )
}
