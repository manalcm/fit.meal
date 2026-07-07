import { supabase } from './supabase'
import type { Ingredient } from '../types/database'

export type IngredientInput = Omit<Ingredient, 'id' | 'created_at'>

export async function listIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase.from('ingredients').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function createIngredient(input: IngredientInput): Promise<Ingredient> {
  const { data, error } = await supabase.from('ingredients').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateIngredient(id: string, input: IngredientInput): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (error) throw error
}

export async function listIngredientNames(): Promise<Set<string>> {
  const { data, error } = await supabase.from('ingredients').select('name')
  if (error) throw error
  return new Set((data ?? []).map((r) => r.name.toLowerCase()))
}

/**
 * Inserta ingredientes nuevos por nombre y, para los que ya existen,
 * actualiza o ignora según `onConflict`.
 */
export async function bulkUpsertIngredients(
  rows: IngredientInput[],
  onConflict: 'update' | 'skip',
): Promise<{ inserted: number; updated: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, updated: 0, skipped: 0 }

  // Se trae toda la tabla (nombre e id) en vez de filtrar por una lista de
  // nombres: con cientos de filas a importar, un .in(...) generaría una URL
  // demasiado larga para la petición GET de PostgREST.
  const { data: existing, error: fetchError } = await supabase
    .from('ingredients')
    .select('id, name')
  if (fetchError) throw fetchError

  const existingByName = new Map(existing?.map((e) => [e.name.toLowerCase(), e.id]) ?? [])

  const toInsert = rows.filter((r) => !existingByName.has(r.name.toLowerCase()))
  const toUpdate = rows.filter((r) => existingByName.has(r.name.toLowerCase()))

  if (toInsert.length > 0) {
    const { error } = await supabase.from('ingredients').insert(toInsert)
    if (error) throw error
  }

  if (onConflict === 'update' && toUpdate.length > 0) {
    const rowsWithId = toUpdate.map((row) => ({
      ...row,
      id: existingByName.get(row.name.toLowerCase())!,
    }))
    const { error } = await supabase.from('ingredients').upsert(rowsWithId, { onConflict: 'id' })
    if (error) throw error
  }

  return {
    inserted: toInsert.length,
    updated: onConflict === 'update' ? toUpdate.length : 0,
    skipped: onConflict === 'skip' ? toUpdate.length : 0,
  }
}
