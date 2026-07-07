import { supabase } from './supabase'
import type { Ingredient } from '../types/database'
import { requireActiveHouseholdId } from './householdScope'

export type IngredientInput = Omit<Ingredient, 'id' | 'household_id' | 'created_at'>

function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function sameIngredientValues(existing: Ingredient, incoming: IngredientInput): boolean {
  return (
    existing.category === incoming.category &&
    Number(existing.kcal_per_100g) === Number(incoming.kcal_per_100g) &&
    Number(existing.protein_per_100g) === Number(incoming.protein_per_100g) &&
    Number(existing.carbs_per_100g) === Number(incoming.carbs_per_100g) &&
    Number(existing.fat_per_100g) === Number(incoming.fat_per_100g)
  )
}

export async function listIngredients(): Promise<Ingredient[]> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('household_id', householdId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createIngredient(input: IngredientInput): Promise<Ingredient> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('ingredients')
    .insert({ ...input, household_id: householdId })
    .select()
    .single()
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
  const householdId = requireActiveHouseholdId()
  const { error } = await supabase.from('ingredients').delete().eq('id', id).eq('household_id', householdId)
  if (error) throw error
}

export async function deleteAllIngredients(): Promise<void> {
  const householdId = requireActiveHouseholdId()
  const { error: mealLinesError } = await supabase
    .from('meal_ingredients')
    .delete()
    .eq('household_id', householdId)
  if (mealLinesError) throw mealLinesError

  const { error } = await supabase.from('ingredients').delete().eq('household_id', householdId)
  if (error) throw error
}

export async function listIngredientNames(): Promise<Set<string>> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('ingredients')
    .select('name')
    .eq('household_id', householdId)
  if (error) throw error
  return new Set((data ?? []).map((r) => normalizeIngredientName(r.name)))
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
  const householdId = requireActiveHouseholdId()

  // Se trae toda la tabla (nombre e id) en vez de filtrar por una lista de
  // nombres: con cientos de filas a importar, un .in(...) generaría una URL
  // demasiado larga para la petición GET de PostgREST.
  const { data: existing, error: fetchError } = await supabase
    .from('ingredients')
    .select('*')
    .eq('household_id', householdId)
  if (fetchError) throw fetchError

  const existingByName = new Map(
    ((existing ?? []) as Ingredient[]).map((e) => [normalizeIngredientName(e.name), e]),
  )

  const exactDuplicates = rows.filter((r) => {
    const existingRow = existingByName.get(normalizeIngredientName(r.name))
    return existingRow ? sameIngredientValues(existingRow, r) : false
  })
  const toInsert = rows.filter((r) => !existingByName.has(normalizeIngredientName(r.name)))
  const toUpdate = rows.filter((r) => {
    const existingRow = existingByName.get(normalizeIngredientName(r.name))
    return existingRow ? !sameIngredientValues(existingRow, r) : false
  })

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from('ingredients')
      .insert(toInsert.map((row) => ({ ...row, household_id: householdId })))
    if (error) throw error
  }

  if (onConflict === 'update' && toUpdate.length > 0) {
    const rowsWithId = toUpdate.map((row) => ({
      ...row,
      id: existingByName.get(normalizeIngredientName(row.name))!.id,
      household_id: householdId,
    }))
    const { error } = await supabase.from('ingredients').upsert(rowsWithId, { onConflict: 'id' })
    if (error) throw error
  }

  return {
    inserted: toInsert.length,
    updated: onConflict === 'update' ? toUpdate.length : 0,
    skipped: exactDuplicates.length + (onConflict === 'skip' ? toUpdate.length : 0),
  }
}
