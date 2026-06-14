'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Tables, InsertTables } from '@/supabase/types'

type SaveResult = { success: true } | { error: string }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function requireModerator() {
  const { supabase, user } = await requireAuth()
  if (!user) return { supabase, user: null, isMod: false }
  const { data: role } = await supabase.rpc('get_user_role')
  return { supabase, user, isMod: role === 'moderator' }
}

// ---------------------------------------------------------------------------
// Invite validation (unauthenticated — called from login page)
// ---------------------------------------------------------------------------

export async function validateInviteCode(code: string): Promise<{ valid: true } | { error: string }> {
  if (!code.trim()) return { error: 'Invite code is required' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('validate_invite_code', { p_code: code.trim() })
  if (error) return { error: 'Could not validate invite code' }
  return data ? { valid: true } : { error: 'This invite has expired or already been used' }
}

// ---------------------------------------------------------------------------
// Flags — any authenticated user can flag, moderator resolves
// ---------------------------------------------------------------------------

export async function createFlag(observationId: string, reason: string): Promise<SaveResult> {
  const { supabase, user } = await requireAuth()
  if (!user) return { error: 'Not authenticated' }
  if (!reason.trim()) return { error: 'Reason is required' }

  const { error } = await supabase.from('flags').insert({
    observation_id: observationId,
    flagged_by: user.id,
    reason: reason.trim(),
  })

  if (error) return { error: error.message }
  return { success: true }
}

export type FlagWithObservation = Tables<'flags'> & {
  price_observations: Pick<Tables<'price_observations'>, 'vendor_id' | 'cut_id' | 'price_per_kg' | 'observed_at'> | null
}

export async function listUnresolvedFlags(): Promise<{ flags: FlagWithObservation[] } | { error: string }> {
  const { supabase, user, isMod } = await requireModerator()
  if (!user) return { error: 'Not authenticated' }
  if (!isMod) return { error: 'Forbidden' }

  const { data, error } = await supabase
    .from('flags')
    .select('*, price_observations(vendor_id, cut_id, price_per_kg, observed_at)')
    .is('resolved_by', null)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { flags: (data ?? []) as FlagWithObservation[] }
}

export async function resolveFlag(flagId: string, resolution: string): Promise<SaveResult> {
  const { supabase, user, isMod } = await requireModerator()
  if (!user) return { error: 'Not authenticated' }
  if (!isMod) return { error: 'Forbidden' }
  if (!resolution.trim()) return { error: 'Resolution note is required' }

  const { error } = await supabase
    .from('flags')
    .update({
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution: resolution.trim(),
    })
    .eq('id', flagId)

  if (error) return { error: error.message }
  revalidatePath('/moderator/flags')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Invites — moderator only
// ---------------------------------------------------------------------------

export async function generateInvite(): Promise<{ code: string; expires_at: string } | { error: string }> {
  const { supabase, user, isMod } = await requireModerator()
  if (!user) return { error: 'Not authenticated' }
  if (!isMod) return { error: 'Forbidden' }

  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('invites').insert({
    code,
    created_by: user.id,
    expires_at,
  })

  if (error) return { error: error.message }
  revalidatePath('/moderator/invites')
  return { code, expires_at }
}

export async function listInvites(): Promise<{ invites: Tables<'invites'>[] } | { error: string }> {
  const { supabase, user, isMod } = await requireModerator()
  if (!user) return { error: 'Not authenticated' }
  if (!isMod) return { error: 'Forbidden' }

  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { invites: data ?? [] }
}

// ---------------------------------------------------------------------------
// Alias suggestions — moderator only
// ---------------------------------------------------------------------------

export type SuggestionWithCut = Tables<'alias_suggestions'> & {
  cuts: Pick<Tables<'cuts'>, 'name_en' | 'name_he'> | null
}

export async function listAliasSuggestions(): Promise<{ suggestions: SuggestionWithCut[] } | { error: string }> {
  const { supabase, user, isMod } = await requireModerator()
  if (!user) return { error: 'Not authenticated' }
  if (!isMod) return { error: 'Forbidden' }

  const { data, error } = await supabase
    .from('alias_suggestions')
    .select('*, cuts(name_en, name_he)')
    .is('promoted_at', null)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { suggestions: (data ?? []) as SuggestionWithCut[] }
}

export async function promoteAliasSuggestion(suggestionId: string): Promise<SaveResult> {
  const { supabase, user, isMod } = await requireModerator()
  if (!user) return { error: 'Not authenticated' }
  if (!isMod) return { error: 'Forbidden' }

  // Fetch the suggestion to get cut_id and suggested_alias
  const { data: suggestion, error: fetchErr } = await supabase
    .from('alias_suggestions')
    .select('cut_id, suggested_alias')
    .eq('id', suggestionId)
    .single()

  if (fetchErr || !suggestion) return { error: fetchErr?.message ?? 'Suggestion not found' }

  // Insert into cut_aliases
  const { error: insertErr } = await supabase.from('cut_aliases').insert({
    cut_id: suggestion.cut_id,
    alias: suggestion.suggested_alias,
    lang: 'mixed',
  })

  if (insertErr) return { error: insertErr.message }

  // Mark as promoted
  const { error: updateErr } = await supabase
    .from('alias_suggestions')
    .update({ promoted_at: new Date().toISOString(), promoted_by: user.id })
    .eq('id', suggestionId)

  if (updateErr) return { error: updateErr.message }

  revalidatePath('/moderator/aliases')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Vendor suggestions — any authenticated contributor
// ---------------------------------------------------------------------------

type VendorSuggestionInput = Pick<InsertTables<'vendors'>, 'name' | 'city' | 'type' | 'region' | 'website' | 'phone'>

export async function suggestVendor(data: VendorSuggestionInput): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await requireAuth()
  if (!user) return { error: 'Not authenticated' }

  if (!data.name.trim() || !data.city.trim()) return { error: 'Name and city are required' }

  const { data: row, error } = await supabase
    .from('vendors')
    .insert({
      ...data,
      name: data.name.trim(),
      city: data.city.trim(),
      status: 'pending',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !row) return { error: error?.message ?? 'Failed to submit suggestion' }
  return { id: row.id }
}

// ---------------------------------------------------------------------------
// Pending vendor management — moderator only
// ---------------------------------------------------------------------------

export async function listPendingVendors(): Promise<{ vendors: Tables<'vendors'>[] } | { error: string }> {
  const { supabase, user, isMod } = await requireModerator()
  if (!user) return { error: 'Not authenticated' }
  if (!isMod) return { error: 'Forbidden' }

  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { vendors: data ?? [] }
}

export async function approveVendor(vendorId: string): Promise<SaveResult> {
  const { supabase, user, isMod } = await requireModerator()
  if (!user) return { error: 'Not authenticated' }
  if (!isMod) return { error: 'Forbidden' }

  const { error } = await supabase.from('vendors').update({ status: 'active' }).eq('id', vendorId)
  if (error) return { error: error.message }
  revalidatePath('/moderator/vendors')
  revalidatePath('/vendors')
  return { success: true }
}

export async function rejectVendor(vendorId: string): Promise<SaveResult> {
  const { supabase, user, isMod } = await requireModerator()
  if (!user) return { error: 'Not authenticated' }
  if (!isMod) return { error: 'Forbidden' }

  const { error } = await supabase.from('vendors').update({ status: 'closed' }).eq('id', vendorId)
  if (error) return { error: error.message }
  revalidatePath('/moderator/vendors')
  return { success: true }
}
