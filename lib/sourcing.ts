// Pure scoring engine — no Supabase imports. Testable in isolation.
import type { Tables } from '@/supabase/types'
import type { ShoppingListItem, SourcingCandidate, SourcingLineItem } from '@/lib/types'
import { observationFreshness } from '@/lib/aliases'
import type { Freshness, ObservationSource } from '@/lib/aliases'

type VendorRow = Tables<'vendors'>
type PriceRow = Pick<
  Tables<'price_observations'>,
  'vendor_id' | 'cut_id' | 'price_per_kg' | 'source' | 'is_sale' | 'sale_ends_at' | 'observed_at'
>

export interface ScoreVendorsParams {
  items: ShoppingListItem[]
  pickupVendors: VendorRow[]
  deliveryVendors: VendorRow[]
  /** key: `${vendor_id}:${cut_id}` → most-recent active price */
  pricesByVendorCut: Map<string, PriceRow>
  /** key: `${region}:${cut_id}` → 90-day regional median price_per_kg */
  mediansByRegionCut: Map<string, number>
  cutNamesById: Map<string, { name_en: string; name_he: string }>
  userLat: number
  userLng: number
}

/** Haversine great-circle distance in km (no external dependency). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Score all candidate vendors against the shopping list.
 *
 * Business rules (from CLAUDE.md):
 * - Coverage ≥ 70% of list weight required (penalised items count as covered)
 * - Expired prices excluded from total; replaced by regional median × 1.15
 * - Missing prices also replaced by regional median × 1.15
 * - Items with no price AND no median are uncovered (hurt coverage %)
 * - Delivery vendors below delivery_min_order are excluded
 * - Score = Σ(price_per_kg × kg) + delivery_fee; lower is better
 */
export function scoreVendors(params: ScoreVendorsParams): SourcingCandidate[] {
  const { items, pickupVendors, deliveryVendors, pricesByVendorCut, mediansByRegionCut, cutNamesById, userLat, userLng } =
    params

  // Ignore items with 0 kg (defensive)
  const validItems = items.filter(i => i.kg > 0)
  if (validItems.length === 0) return []

  const totalKg = validItems.reduce((sum, i) => sum + i.kg, 0)

  type TaggedVendor = VendorRow & { pickup_or_delivery: 'pickup' | 'delivery' }
  const allVendors: TaggedVendor[] = [
    ...pickupVendors.map(v => ({ ...v, pickup_or_delivery: 'pickup' as const })),
    ...deliveryVendors.map(v => ({ ...v, pickup_or_delivery: 'delivery' as const })),
  ]

  const candidates: SourcingCandidate[] = []

  for (const vendor of allVendors) {
    const lineItems: SourcingLineItem[] = []
    let coveredKg = 0
    let rawTotal = 0

    for (const item of validItems) {
      const priceRow = pricesByVendorCut.get(`${vendor.id}:${item.cut_id}`)
      const cutNames = cutNamesById.get(item.cut_id) ?? { name_en: item.cut_id, name_he: item.cut_id }

      let price_per_kg: number | null = null
      let subtotal = 0
      let is_penalized = false
      let freshness: Freshness | null = null
      const observed_at: string | null = priceRow?.observed_at ?? null

      if (priceRow) {
        const f = observationFreshness(
          priceRow.source as ObservationSource,
          new Date(priceRow.observed_at),
          priceRow.is_sale,
          priceRow.sale_ends_at ? new Date(priceRow.sale_ends_at) : null,
        )
        freshness = f
        price_per_kg = priceRow.price_per_kg // keep for display even if expired

        if (f === 'expired') {
          // Excluded from scoring (CLAUDE.md) — fall back to penalty
          const median = mediansByRegionCut.get(`${vendor.region}:${item.cut_id}`)
          if (median != null) {
            subtotal = median * 1.15 * item.kg
            coveredKg += item.kg
            is_penalized = true
          }
          // else: uncovered (subtotal stays 0)
        } else {
          subtotal = priceRow.price_per_kg * item.kg
          coveredKg += item.kg
        }
      } else {
        // No price at all — penalty
        const median = mediansByRegionCut.get(`${vendor.region}:${item.cut_id}`)
        if (median != null) {
          subtotal = median * 1.15 * item.kg
          coveredKg += item.kg
          is_penalized = true
        }
        // else: uncovered
      }

      rawTotal += subtotal
      lineItems.push({
        cut_id: item.cut_id,
        cut_name_en: cutNames.name_en,
        cut_name_he: cutNames.name_he,
        kg: item.kg,
        price_per_kg,
        subtotal,
        is_penalized,
        freshness,
        observed_at,
      })
    }

    // Coverage rule: ≥ 70% of list weight
    const coverage_pct = totalKg > 0 ? coveredKg / totalKg : 0
    if (coverage_pct < 0.7) continue

    // Delivery minimum order
    if (
      vendor.delivers &&
      vendor.delivery_min_order != null &&
      rawTotal < vendor.delivery_min_order
    )
      continue

    // delivery_fee null means unknown; treat as 0 (not "free" — but can't disqualify either)
    const delivery_fee = vendor.delivers ? (vendor.delivery_fee ?? 0) : null
    const total_ils = rawTotal + (delivery_fee ?? 0)

    const distance_km =
      vendor.pickup_or_delivery === 'pickup' && vendor.lat != null && vendor.lng != null
        ? haversineKm(userLat, userLng, vendor.lat, vendor.lng)
        : null

    candidates.push({
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      vendor_city: vendor.city,
      pickup_or_delivery: vendor.pickup_or_delivery,
      distance_km,
      delivery_fee,
      delivery_regions: vendor.delivery_regions,
      total_ils,
      coverage_pct,
      line_items: lineItems,
    })
  }

  // Sort ascending by total cost (lowest = best)
  return candidates.sort((a, b) => a.total_ils - b.total_ils)
}
