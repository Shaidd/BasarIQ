'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/supabase/types'
import type { ShoppingListItem } from '@/lib/types'

type SaveResult = { success: true } | { error: string }

export async function createList(name: string): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'List name cannot be empty' }

  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({ owner_id: user.id, name: trimmed, items: [] as unknown as Json })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create list' }

  revalidatePath('/shop')
  return { id: data.id }
}

export async function deleteList(listId: string): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('shopping_lists')
    .delete()
    .eq('id', listId)
    .eq('owner_id', user.id) // belt-and-suspenders alongside RLS

  if (error) return { error: error.message }

  revalidatePath('/shop')
  return { success: true }
}

export async function upsertListItems(listId: string, items: ShoppingListItem[]): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('shopping_lists')
    .update({
      items: items as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/shop')
  return { success: true }
}

export async function renameList(listId: string, name: string): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'List name cannot be empty' }

  const { error } = await supabase
    .from('shopping_lists')
    .update({ name: trimmed })
    .eq('id', listId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/shop')
  return { success: true }
}
