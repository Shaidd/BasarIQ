import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()

  const [{ count: cutCount }, { count: vendorCount }, { count: priceCount }] = await Promise.all([
    supabase.from('cuts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('price_observations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-gray-500 mt-1">Israel beef price intelligence</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Cuts" value={cutCount ?? 0} href="/cuts" />
        <StatCard label="Vendors" value={vendorCount ?? 0} href="/vendors" />
        <StatCard label="Price entries" value={priceCount ?? 0} href="/cuts" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickLink href="/cuts" title="Browse cuts" desc="Search the beef cut catalog" emoji="🥩" />
        <QuickLink href="/vendors" title="Browse vendors" desc="Find butchers by region" emoji="🏪" />
        <QuickLink href="/ocr" title="Log photo" desc="Scan a price tag with Claude OCR" emoji="📷" />
      </div>
    </main>
  )
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </Link>
  )
}

function QuickLink({ href, title, desc, emoji }: {
  href: string; title: string; desc: string; emoji: string
}) {
  return (
    <Link
      href={href}
      className="bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow flex items-start gap-4"
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-gray-500">{desc}</div>
      </div>
    </Link>
  )
}
