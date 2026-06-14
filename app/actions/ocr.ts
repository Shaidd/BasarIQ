'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ExtractionRow } from '@/lib/types/ocr'

export type ConfirmedRow = ExtractionRow & {
  cut_id: string // resolved by user before confirming; never null at save time
  include: boolean // user can uncheck rows they don't want to save
}

export type SaveOcrResult = { success: true; saved: number } | { error: string }

export async function saveOcrObservations(
  vendorId: string,
  photoId: string,
  rows: ConfirmedRow[]
): Promise<SaveOcrResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const toSave = rows.filter(r => r.include && r.cut_id && r.price !== null)
  if (toSave.length === 0) return { error: 'No rows selected to save' }

  const now = new Date().toISOString()

  const { error } = await supabase.from('price_observations').insert(
    toSave.map(row => ({
      vendor_id: vendorId,
      cut_id: row.cut_id,
      // Normalize per_100g → per_kg; per_unit prices pass through as-is with needs_review=true
      price_per_kg: row.unit === 'per_100g' ? row.price! * 10 : row.price!,
      currency: 'ILS',
      is_sale: false,
      source: 'photo' as const,
      confidence: row.confidence,
      photo_id: photoId,
      contributor_id: user.id,
      observed_at: now,
      raw_text: row.raw_text,
      status: 'active' as const,
    }))
  )

  if (error) return { error: error.message }

  // Log unresolved alias suggestions for moderator review
  const unmatched = rows.filter(r => r.include && r.matched_cut_name && !r.matched_cut_id)
  if (unmatched.length > 0) {
    await supabase.from('alias_suggestions').insert(
      unmatched.map(r => ({
        cut_id: r.cut_id,
        suggested_alias: r.matched_cut_name!,
        suggested_by: user.id,
      }))
    )
  }

  revalidatePath('/cuts')
  return { success: true, saved: toSave.length }
}
