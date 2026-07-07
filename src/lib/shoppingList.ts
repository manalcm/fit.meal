import { supabase } from './supabase'
import { round1 } from './calculations'
import type { Ingredient, IngredientCategory } from '../types/database'
import { requireActiveHouseholdId } from './householdScope'

export interface ShoppingListItem {
  ingredient: Ingredient
  grams: number
  cost: number
}

interface RawEntryForList {
  portion: number | null
  override_grams: number | null
  meal: { meal_ingredients: { quantity_grams: number; ingredient: Ingredient }[] }
}

const LIST_SELECT =
  'portion, override_grams, meal:meals(meal_ingredients(quantity_grams, ingredient:ingredients(*)))'

/** Agrega todos los ingredientes necesarios (de ambas personas) entre dos fechas. */
export async function buildShoppingList(startISO: string, endISO: string): Promise<ShoppingListItem[]> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .select(LIST_SELECT)
    .eq('household_id', householdId)
    .gte('date', startISO)
    .lte('date', endISO)
  if (error) throw error

  const rows = (data ?? []) as unknown as RawEntryForList[]
  const totals = new Map<string, { ingredient: Ingredient; grams: number }>()

  for (const row of rows) {
    const lines = row.meal.meal_ingredients
    const baseGrams = lines.reduce((sum, l) => sum + l.quantity_grams, 0)
    let factor = 0
    if (row.portion != null) factor = row.portion
    else if (row.override_grams != null && baseGrams > 0) factor = row.override_grams / baseGrams
    if (factor <= 0) continue

    for (const line of lines) {
      const grams = line.quantity_grams * factor
      const existing = totals.get(line.ingredient.id)
      if (existing) existing.grams += grams
      else totals.set(line.ingredient.id, { ingredient: line.ingredient, grams })
    }
  }

  return Array.from(totals.values())
    .map(({ ingredient, grams }) => ({
      ingredient,
      grams,
      cost: ingredient.price_per_kg != null ? (grams / 1000) * ingredient.price_per_kg : 0,
    }))
    .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name, 'es'))
}

export function splitPantry(items: ShoppingListItem[]): {
  toBuy: ShoppingListItem[]
  inPantry: ShoppingListItem[]
} {
  return {
    toBuy: items.filter((i) => !i.ingredient.in_pantry),
    inPantry: items.filter((i) => i.ingredient.in_pantry),
  }
}

export function groupByCategory(
  items: ShoppingListItem[],
  order: IngredientCategory[],
): { category: IngredientCategory; items: ShoppingListItem[] }[] {
  const map = new Map<IngredientCategory, ShoppingListItem[]>()
  for (const item of items) {
    const arr = map.get(item.ingredient.category) ?? []
    arr.push(item)
    map.set(item.ingredient.category, arr)
  }
  return order
    .filter((cat) => map.has(cat))
    .map((category) => ({ category, items: map.get(category)! }))
}

/** Convierte los gramos totales a la unidad en la que la persona compra el ingrediente. */
export function formatShoppingQuantity(ingredient: Ingredient, grams: number): string {
  if (ingredient.default_unit === 'unidad' && ingredient.grams_per_unit) {
    const units = Math.ceil(grams / ingredient.grams_per_unit)
    return `${units} ud`
  }
  if (ingredient.default_unit === 'ml') {
    return grams >= 1000 ? `${round1(grams / 1000)} l` : `${Math.ceil(grams)} ml`
  }
  return grams >= 1000 ? `${round1(grams / 1000)} kg` : `${Math.ceil(grams)} g`
}
