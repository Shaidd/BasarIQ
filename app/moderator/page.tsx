import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function ModeratorDashboard() {
  const supabase = await createClient()

  const [
    { count: flagCount },
    { count: pendingVendorCount },
    { count: aliasSuggestionCount },
    { count: activeInviteCount },
  ] = await Promise.all([
    supabase.from('flags').select('id', { count: 'exact', head: true }).is('resolved_by', null),
    supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('alias_suggestions').select('id', { count: 'exact', head: true }).is('promoted_at', null),
    supabase.from('invites').select('id', { count: 'exact', head: true }).is('used_by', null).gt('expires_at', new Date().toISOString()),
  ])

  const cards = [
    { label: 'Unresolved flags', value: flagCount ?? 0, href: '/moderator/flags', urgent: (flagCount ?? 0) > 0 },
    { label: 'Pending vendors', value: pendingVendorCount ?? 0, href: '/moderator/vendors', urgent: false },
    { label: 'Alias suggestions', value: aliasSuggestionCount ?? 0, href: '/moderator/aliases', urgent: false },
    { label: 'Active invites', value: activeInviteCount ?? 0, href: '/moderator/invites', urgent: false },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map(card => (
        <Link
          key={card.href}
          href={card.href}
          className={`rounded-xl border p-5 hover:shadow-sm transition-shadow ${
            card.urgent ? 'border-red-300 bg-red-50' : 'bg-white'
          }`}
        >
          <div className={`text-3xl font-bold ${card.urgent ? 'text-red-600' : 'text-gray-900'}`}>
            {card.value}
          </div>
          <div className="text-sm text-gray-500 mt-1">{card.label}</div>
        </Link>
      ))}
    </div>
  )
}
