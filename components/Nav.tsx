import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'

export default async function Nav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return (
    <nav className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-gray-900 tracking-tight">
            BasarIQ
          </Link>
          <Link href="/cuts" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Cuts
          </Link>
          <Link href="/vendors" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Vendors
          </Link>
          <Link href="/ocr" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Log photo
          </Link>
          <Link href="/shop" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Shop
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[160px]">
            {user.email}
          </span>
          <SignOutButton />
        </div>
      </div>
    </nav>
  )
}
