'use server'

import { createClient } from '@/lib/supabase/server'
import type { Region, Tables } from '@/supabase/types'
import type { ShoppingListItem, SourcingCandidate } from '@/lib/types'
import { scoreVendors } from '@/lib/sourcing'

export type SourcingInput = {
  /** Items are passed directly — no save required before sourcing. */
  items: ShoppingListItem[]
  userLat: number
  userLng: number
  radiusKm: number
}

export type SourcingResult = { candidates: SourcingCandidate[] } | { error: string }

type VendorRow = Tables<'vendors'>
type PriceRow = Pick<
  Tables<'price_observations'>,
  'vendor_id' | 'cut_id' | 'price_per_kg' | 'source' | 'is_sale' | 'sale_ends_at' | 'observed_at'
>

export async function runSourcing(input: SourcingInput): Promise<SourcingResult> {
  const { items, userLat, userLng, radiusKm } = input

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Validate items
  const validItems = items.filter(i => i.cut_id && i.kg > 0)
  if (validItems.length === 0) return { error: 'Shopping list is empty' }

  // Fetch user's home region (used for delivery vendor filtering)
  const { data: profile } = await supabase
    .from('profiles')
    .select('home_region')
    .eq('id', user.id)
    .single()

  const userRegion = profile?.home_region as Region | null
  if (!userRegion) {
    return {
      error: 'Your home region is not set. Please update your profile before sourcing.',
    }
  }

  const cutIds = [...new Set(validItems.map(i => i.cut_id))]

  // Parallel: pickup vendors (in radius) + all delivery vendors
  const [pickupResult, deliveryResult] = await Promise.all([
    supabase.rpc('get_vendors_in_radius', {
      user_lat: userLat,
      user_lng: userLng,
      radius_km: radiusKm,
    }),
    supabase
      .from('vendors')
      .select('*')
      .eq('status', 'active')
      .eq('delivers', true),
  ])

  const pickupVendors = (pickupResult.data ?? []) as unknown as VendorRow[]

  // Filter delivery vendors by user's home region (client-side — simpler than PostgREST OR)
  const allDeliveryVendors = (deliveryResult.data ?? []) as unknown as VendorRow[]
  const deliveryVendors = allDeliveryVendors.filter(v => {
    if (!v.delivery_regions) return false
    return v.delivery_regions.includes('*') || v.delivery_regions.includes(userRegion)
  })

  // Deduplicate: a vendor that delivers AND is in pickup radius appears in both lists.
  // Keep them as pickup (more specific distance info).
  const pickupIds = new Set(pickupVendors.map(v => v.id))
  const uniqueDeliveryVendors = deliveryVendors.filter(v => !pickupIds.has(v.id))

  const allVendors = [...pickupVendors, ...uniqueDeliveryVendors]
  if (allVendors.length === 0) {
    return { candidates: [] }
  }

  const allVendorIds = allVendors.map(v => v.id)

  // Fetch most-recent active prices for all candidate vendors × cuts in one query
  const { data: pricesRaw } = await supabase
    .from('price_observations')
    .select('vendor_id, cut_id, price_per_kg, source, is_sale, sale_ends_at, observed_at')
    .eq('status', 'active')
    .in('vendor_id', allVendorIds)
    .in('cut_id', cutIds)
    .order('observed_at', { ascending: false })

  // Build Map: keep only the most-recent price per (vendor, cut) — first wins due to DESC order
  const pricesByVendorCut = new Map<string, PriceRow>()
  for (const row of (pricesRaw ?? []) as PriceRow[]) {
    const key = `${row.vendor_id}:${row.cut_id}`
    if (!pricesByVendorCut.has(key)) {
      pricesByVendorCut.set(key, row)
    }
  }

  // Collect unique (region, cut_id) pairs across all candidate vendors
  const regionCutPairs = new Set<string>()
  for (const v of allVendors) {
    for (const cut_id of cutIds) {
      regionCutPairs.add(`${v.region}:${cut_id}`)
    }
  }

  // Batch-fetch regional medians concurrently
  const medianEntries = await Promise.all(
    [...regionCutPairs].map(async pair => {
      const colonIdx = pair.indexOf(':')
      const region = pair.slice(0, colonIdx)
      const cut_id = pair.slice(colonIdx + 1)
      const { data } = await supabase.rpc('cut_regional_median', {
        p_cut_id: cut_id,
        p_region: region,
      })
      return [pair, data as number | null] as const
    }),
  )

  const mediansByRegionCut = new Map<string, number>()
  for (const [pair, value] of medianEntries) {
    if (value != null) mediansByRegionCut.set(pair, value)
  }

  // Fetch cut names for display
  const { data: cutsRaw } = await supabase
    .from('cuts')
    .select('id, name_en, name_he')
    .in('id', cutIds)

  const cutNamesById = new Map<string, { name_en: string; name_he: string }>()
  for (const c of cutsRaw ?? []) {
    cutNamesById.set(c.id, { name_en: c.name_en, name_he: c.name_he })
  }

  const candidates = scoreVendors({
    items: validItems,
    pickupVendors,
    deliveryVendors: uniqueDeliveryVendors,
    pricesByVendorCut,
    mediansByRegionCut,
    cutNamesById,
    userLat,
    userLng,
  })

  return { candidates }
}
