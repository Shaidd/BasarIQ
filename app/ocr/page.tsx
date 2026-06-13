import { createClient } from '@/lib/supabase/server'
import OcrUploader from '@/components/OcrUploader'
import type { Tables } from '@/supabase/types'

type VendorOption = Pick<Tables<'vendors'>, 'id' | 'name' | 'city' | 'region'>
type CutOption = Pick<Tables<'cuts'>, 'id' | 'name_en' | 'name_he'>

export default async function OcrPage() {
  const supabase = await createClient()

  const [{ data: vendorData }, { data: cutData }] = await Promise.all([
    supabase
      .from('vendors')
      .select('id, name, city, region')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('cuts')
      .select('id, name_en, name_he')
      .eq('status', 'active')
      .order('name_en'),
  ])

  const vendors = (vendorData ?? []) as unknown as VendorOption[]
  const cuts = (cutData ?? []) as unknown as CutOption[]

  return (
    <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Log prices from photo</h1>
        <p className="text-sm text-gray-500 mt-1">
          Take a photo of a price tag or shelf label — Claude will extract the prices for you.
        </p>
      </div>
      <OcrUploader vendors={vendors} cuts={cuts} />
    </main>
  )
}
