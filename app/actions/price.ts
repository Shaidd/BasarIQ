'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PriceInput = {
  cutId: string
  vendorId: string
  pricePerKg: number
  isSale: boolean
  saleEndsAt: string | null
  confirmed: boolean
}

export type PriceResult =
  | { success: true }
  | { error: string }
  | { warning: true; warningType: 'below' | 'above'; median: number }

// Minimal typed interface for the three DB operations this action needs.
// Replaced automatically once `npx supabase gen types` runs against a live DB.
interface MinimalDb {
  from(table: 'vendors'): {
    select(cols: string): {
      eq(col: string, val: string): {
        single(): Promise<{ data: { region: string } | null; error: unknown }>
      }
    }
  }
  from(table: 'price_observations'): {
    insert(data: Record<string, unknown>): Promise<{ error: { message: string } | null }>
  }
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: number | null; error: unknown }>
}

export async function addPriceObservation(input: PriceInput): Promise<PriceResult> {
  const { cutId, vendorId, pricePerKg, isSale, saleEndsAt, confirmed } = input

  if (!cutId || !vendorId || !pricePerKg || pricePerKg <= 0) {
    return { error: 'Invalid input' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const db = supabase as unknown as MinimalDb

  const { data: vendor } = await db
    .from('vendors')
    .select('region')
    .eq('id', vendorId)
    .single()

  if (!vendor) return { error: 'Vendor not found' }

  if (!confirmed) {
    const { data: median } = await db.rpc('cut_regional_median', {
      p_cut_id: cutId,
      p_region: vendor.region,
    })

    if (median != null) {
      if (pricePerKg < median * 0.3) {
        return { warning: true, warningType: 'below', median }
      }
      if (pricePerKg > median * 3.0) {
        return { warning: true, warningType: 'above', median }
      }
    }
  }

  const { error } = await db.from('price_observations').insert({
    vendor_id: vendorId,
    cut_id: cutId,
    price_per_kg: pricePerKg,
    currency: 'ILS',
    is_sale: isSale,
    sale_ends_at: saleEndsAt || null,
    source: 'manual',
    contributor_id: user.id,
    observed_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath(`/cuts/${cutId}`)
  return { success: true }
}
