// Shared application types (non-DB)

export type { Region, UserRole, CutCategory, CutPrimal, CutStatus, VendorType, VendorStatus, ObservationSource, ObservationStatus, AliasLang, Tables, InsertTables, UpdateTables } from '@/supabase/types'

// Claude extraction contract — same schema used by photo OCR and web extraction.
// All prices must be normalised to ₪/kg before this struct is produced.
export type ExtractionRow = {
  raw_text: string
  matched_cut_id: string | null
  price: number | null
  unit: 'per_kg' | 'per_100g' | 'per_unit' | 'ambiguous'
  confidence: number      // 0–1
  needs_review: boolean
}

// Shopping list item
export type ShoppingListItem = {
  cut_id: string
  kg: number
}

// Sourcing result per vendor
export type SourcingCandidate = {
  vendor_id: string
  vendor_name: string
  pickup_or_delivery: 'pickup' | 'delivery'
  distance_km: number | null        // null for delivery vendors
  delivery_fee: number | null
  delivery_regions: string[] | null
  total_ils: number
  coverage_pct: number              // 0–1
  line_items: SourcingLineItem[]
}

export type SourcingLineItem = {
  cut_id: string
  cut_name_en: string
  cut_name_he: string
  kg: number
  price_per_kg: number | null       // null = missing, uses penalty
  subtotal: number
  is_penalized: boolean
  freshness: 'fresh' | 'stale' | 'expired' | null
  observed_at: string | null
}

// Freshness badge mapping
export const FRESHNESS_LABELS = {
  fresh: '🟢',
  stale: '🟡',
  expired: '🔴',
} as const
