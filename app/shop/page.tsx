import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/supabase/types'
import ShoppingListManager from '@/components/ShoppingListManager'

type ListRow = { id: string; name: string; items: Json }
type CutOption = { id: string; name_en: string; name_he: string }

export default async function ShopPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: listsRaw }, { data: cutsRaw }] = await Promise.all([
    supabase
      .from('shopping_lists')
      .select('id, name, items')
      .eq('owner_id', user.id)
      .order('created_at'),
    supabase
      .from('cuts')
      .select('id, name_en, name_he')
      .eq('status', 'active')
      .order('name_en'),
  ])

  const lists = (listsRaw ?? []) as unknown as ListRow[]
  const cuts = (cutsRaw ?? []) as unknown as CutOption[]

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <ShoppingListManager lists={lists} cuts={cuts} />
    </main>
  )
}
