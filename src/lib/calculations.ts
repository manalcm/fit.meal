import type { Ingredient } from '../types/database'

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  cost: number
}

const ZERO_TOTALS: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, cost: 0 }

export function scaleIngredient(ingredient: Ingredient, grams: number): Totals {
  const factor = grams / 100
  return {
    kcal: ingredient.kcal_per_100g * factor,
    protein: ingredient.protein_per_100g * factor,
    carbs: ingredient.carbs_per_100g * factor,
    fat: ingredient.fat_per_100g * factor,
    cost: ingredient.price_per_kg != null ? (grams / 1000) * ingredient.price_per_kg : 0,
  }
}

export function sumTotals(items: Totals[]): Totals {
  return items.reduce(
    (acc, t) => ({
      kcal: acc.kcal + t.kcal,
      protein: acc.protein + t.protein,
      carbs: acc.carbs + t.carbs,
      fat: acc.fat + t.fat,
      cost: acc.cost + t.cost,
    }),
    { ...ZERO_TOTALS },
  )
}

export function computeMealTotals(
  lines: { ingredient: Ingredient; quantity_grams: number }[],
): Totals {
  return sumTotals(lines.map((l) => scaleIngredient(l.ingredient, l.quantity_grams)))
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Totales de una entrada del plan = totales del plato × portion, o
 * reescalados proporcionalmente si se usa override_grams en vez de portion.
 */
export function computePlanEntryTotals(
  mealLines: { ingredient: Ingredient; quantity_grams: number }[],
  entry: { portion: number | null; override_grams: number | null },
): Totals {
  const baseTotals = computeMealTotals(mealLines)
  if (entry.portion != null) {
    return {
      kcal: baseTotals.kcal * entry.portion,
      protein: baseTotals.protein * entry.portion,
      carbs: baseTotals.carbs * entry.portion,
      fat: baseTotals.fat * entry.portion,
      cost: baseTotals.cost * entry.portion,
    }
  }
  if (entry.override_grams != null) {
    const baseGrams = mealLines.reduce((sum, l) => sum + l.quantity_grams, 0)
    const factor = baseGrams > 0 ? entry.override_grams / baseGrams : 0
    return {
      kcal: baseTotals.kcal * factor,
      protein: baseTotals.protein * factor,
      carbs: baseTotals.carbs * factor,
      fat: baseTotals.fat * factor,
      cost: baseTotals.cost * factor,
    }
  }
  return { ...ZERO_TOTALS }
}
