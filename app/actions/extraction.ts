'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Tables, VendorSourceKind } from '@/supabase/types'

type SaveResult = { success: true } | { error: string }

async function requireModerator() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, isMod: false }
  const { data: role } = await supabase.rpc('get_user_role')
  return { supabase, user, isMod: role === 'moderator' }
}

// ---------------------------------------------------------------------------
// Review queue types
// ---------------------------------------------------------------------------

export type ObservationForReview = Tables<'price_observations'> & {
  vendors: Pick<Tables<'vendors'>, 'name' | 'region'> | null
  cuts: Pick<Tables<'cuts'>, 'name_en' | 'name_he'> | null
}

export type SourceWithVendor = Tables<'vendor_sources'> & {
  vendors: Pick<Tables<'vendors'>, 'name' | 'city'> | null
}

// ---------------------------------------------------------------------------
// Review queue actions
// ---------------------------------------------------------------------------

export async function listPendingExtractions(): Promise<{ items: ObservationForReview[] } | { error: string }> {
  const { supabase, isMod } = await requireModerator()
  if (!isMod) return { error: 'Forbidden' }

  const { data, error } = await supabase
    .from('price_observations')
    .select('*, vendors(name, region), cuts(name_en, name_he)')
    .eq('source', 'web_auto')
    .eq('status', 'hidden')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { items: (data ?? []) as unknown as ObservationForReview[] }
}

export async function approveExtraction(id: string): Promise<SaveResult> {
  const { supabase, isMod } = await requireModerator()
  if (!isMod) return { error: 'Forbidden' }

  const { error } = await supabase
    .from('price_observations')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('source', 'web_auto')

  if (error) return { error: error.message }
  revalidatePath('/moderator/extractions')
  revalidatePath('/moderator')
  return { success: true }
}

export async function rejectExtraction(id: string): Promise<SaveResult> {
  const { supabase, isMod } = await requireModerator()
  if (!isMod) return { error: 'Forbidden' }

  const { error } = await supabase
    .from('price_observations')
    .update({ status: 'removed' })
    .eq('id', id)
    .eq('source', 'web_auto')

  if (error) return { error: error.message }
  revalidatePath('/moderator/extractions')
  revalidatePath('/moderator')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Source management actions
// ---------------------------------------------------------------------------

export async function listVendorSources(): Promise<{ sources: SourceWithVendor[] } | { error: string }> {
  const { supabase, isMod } = await requireModerator()
  if (!isMod) return { error: 'Forbidden' }

  const { data, error } = await supabase
    .from('vendor_sources')
    .select('*, vendors(name, city)')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { sources: (data ?? []) as unknown as SourceWithVendor[] }
}

export async function addVendorSource(
  vendorId: string,
  url: string,
  kind: VendorSourceKind,
): Promise<{ id: string } | { error: string }> {
  const { supabase, isMod } = await requireModerator()
  if (!isMod) return { error: 'Forbidden' }

  if (!url.trim()) return { error: 'URL is required' }

  const { data, error } = await supabase
    .from('vendor_sources')
    .insert({ vendor_id: vendorId, url: url.trim(), kind })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/moderator/sources')
  return { id: data.id }
}

export async function pauseVendorSource(sourceId: string): Promise<SaveResult> {
  const { supabase, isMod } = await requireModerator()
  if (!isMod) return { error: 'Forbidden' }

  const { error } = await supabase
    .from('vendor_sources')
    .update({ status: 'paused' })
    .eq('id', sourceId)

  if (error) return { error: error.message }
  revalidatePath('/moderator/sources')
  return { success: true }
}

export async function resumeVendorSource(sourceId: string): Promise<SaveResult> {
  const { supabase, isMod } = await requireModerator()
  if (!isMod) return { error: 'Forbidden' }

  const { error } = await supabase
    .from('vendor_sources')
    .update({ status: 'active', fail_count: 0 })
    .eq('id', sourceId)

  if (error) return { error: error.message }
  revalidatePath('/moderator/sources')
  return { success: true }
}

export async function listIngestionRuns(
  sourceId: string,
): Promise<{ runs: Tables<'ingestion_runs'>[] } | { error: string }> {
  const { supabase, isMod } = await requireModerator()
  if (!isMod) return { error: 'Forbidden' }

  const { data, error } = await supabase
    .from('ingestion_runs')
    .select('*')
    .eq('source_id', sourceId)
    .order('started_at', { ascending: false })
    .limit(10)

  if (error) return { error: error.message }
  return { runs: data ?? [] }
}
