import type { Ingredient, IngredientUnit, LegacyPlanSnapshot, PlanEntryKind } from '../types/database'

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  cost: number
}

const ZERO_TOTALS: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, cost: 0 }

export function scaleIngredient(ingredient: Ingredient, quantity: number): Totals {
  const factor = quantity / 100
  return {
    kcal: ingredient.kcal_per_100g * factor,
    protein: ingredient.protein_per_100g * factor,
    carbs: ingredient.carbs_per_100g * factor,
    fat: ingredient.fat_per_100g * factor,
    cost: ingredient.price_per_kg != null ? (quantity / 1000) * ingredient.price_per_kg : 0,
  }
}

/** Calcula un ingrediente sin asumir que todo se pesa. */
export function computeIngredientQuantityTotals(
  ingredient: Ingredient,
  quantity: number,
  unit: IngredientUnit,
): Totals {
  if (!Number.isFinite(quantity) || quantity <= 0) return { ...ZERO_TOTALS }

  const nutritionUnit = ingredient.nutrition_unit ?? 'gramos'
  let nutritionQuantity: number | null = null
  let divisor = nutritionUnit === 'unidad' ? 1 : 100

  if (unit === nutritionUnit) {
    nutritionQuantity = quantity
  } else if (
    nutritionUnit === 'gramos' &&
    unit === 'unidad' &&
    ingredient.grams_per_unit != null &&
    ingredient.grams_per_unit > 0
  ) {
    nutritionQuantity = quantity * ingredient.grams_per_unit
    divisor = 100
  }

  if (nutritionQuantity == null) return { ...ZERO_TOTALS }
  const factor = nutritionQuantity / divisor
  const totals: Totals = {
    kcal: ingredient.kcal_per_100g * factor,
    protein: ingredient.protein_per_100g * factor,
    carbs: ingredient.carbs_per_100g * factor,
    fat: ingredient.fat_per_100g * factor,
    cost: 0,
  }

  if (
    ingredient.package_price != null && ingredient.package_price > 0 &&
    ingredient.package_size != null && ingredient.package_size > 0 &&
    ingredient.package_unit === unit
  ) {
    totals.cost = quantity / ingredient.package_size * ingredient.package_price
  } else if (unit === 'gramos' && ingredient.price_per_kg != null) {
    totals.cost = quantity / 1000 * ingredient.price_per_kg
  } else if (unit === 'unidad' && ingredient.grams_per_unit != null && ingredient.price_per_kg != null) {
    totals.cost = quantity * ingredient.grams_per_unit / 1000 * ingredient.price_per_kg
  }
  return totals
}

export function sumTotals(items: Totals[]): Totals {
  return items.reduce(
    (acc, totals) => ({
      kcal: acc.kcal + totals.kcal,
      protein: acc.protein + totals.protein,
      carbs: acc.carbs + totals.carbs,
      fat: acc.fat + totals.fat,
      cost: acc.cost + totals.cost,
    }),
    { ...ZERO_TOTALS },
  )
}

export function scaleTotals(totals: Totals, factor: number): Totals {
  return {
    kcal: totals.kcal * factor,
    protein: totals.protein * factor,
    carbs: totals.carbs * factor,
    fat: totals.fat * factor,
    cost: totals.cost * factor,
  }
}

export function computeMealTotals(
  lines: { ingredient: Ingredient; quantity_grams: number; quantity?: number; unit?: IngredientUnit }[],
): Totals {
  return sumTotals(lines.map((line) => computeIngredientQuantityTotals(
    line.ingredient,
    line.quantity ?? line.quantity_grams,
    line.unit ?? 'gramos',
  )))
}

export function computeMealPerServingTotals(
  lines: { ingredient: Ingredient; quantity_grams: number; quantity?: number; unit?: IngredientUnit }[],
  recipeServings: number,
): Totals {
  if (!Number.isFinite(recipeServings) || recipeServings <= 0) return { ...ZERO_TOTALS }
  return scaleTotals(computeMealTotals(lines), 1 / recipeServings)
}

export function looseQuantityInNutritionalGrams(
  ingredient: Ingredient,
  quantity: number,
  unit: IngredientUnit,
): number {
  if (unit !== ingredient.default_unit || !Number.isFinite(quantity) || quantity <= 0) return 0
  if (unit === 'unidad') {
    return ingredient.grams_per_unit != null && ingredient.grams_per_unit > 0
      ? quantity * ingredient.grams_per_unit
      : 0
  }
  return quantity
}

export function computeLooseIngredientTotals(
  ingredient: Ingredient,
  quantity: number,
  unit: IngredientUnit,
): Totals {
  if (unit !== ingredient.default_unit || !Number.isFinite(quantity) || quantity <= 0) {
    return { ...ZERO_TOTALS }
  }

  return computeIngredientQuantityTotals(ingredient, quantity, unit)
}

export function ingredientQuantityPerServing(quantity: number, recipeServings: number): number {
  if (!Number.isFinite(recipeServings) || recipeServings <= 0) return 0
  return quantity / recipeServings
}

export function isHalfServingStep(value: number): boolean {
  return Number.isFinite(value) && value >= 0.5 && Number.isInteger(value * 2)
}

export function clampServingStep(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.max(0.5, Math.round(value * 2) / 2)
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

interface PlanQuantity {
  planned_servings: number | null
  portion: number | null
  override_grams: number | null
  legacy_snapshot?: LegacyPlanSnapshot | null
}

/**
 * Las entradas nuevas se calculan con raciones / raciones producidas.
 * Las entradas históricas no convertibles conservan su instantánea original.
 */
export function computePlanEntryTotals(
  mealLines: { ingredient: Ingredient; quantity_grams: number; quantity?: number; unit?: IngredientUnit }[],
  entry: PlanQuantity,
  recipeServings = 1,
): Totals {
  if (entry.planned_servings != null) {
    if (recipeServings <= 0) return { ...ZERO_TOTALS }
    return scaleTotals(computeMealTotals(mealLines), entry.planned_servings / recipeServings)
  }

  if (entry.legacy_snapshot?.totals) {
    return { ...entry.legacy_snapshot.totals }
  }

  const baseTotals = computeMealTotals(mealLines)
  if (entry.portion != null) return scaleTotals(baseTotals, entry.portion)

  if (entry.override_grams != null) {
    const baseGrams = mealLines.reduce((sum, line) => sum + line.quantity_grams, 0)
    const factor = baseGrams > 0 ? entry.override_grams / baseGrams : 0
    return scaleTotals(baseTotals, factor)
  }

  return { ...ZERO_TOTALS }
}
interface PlanEntryDetails extends PlanQuantity {
  entry_kind: PlanEntryKind
  exact_quantity: number | null
  exact_unit: IngredientUnit | null
  meal: {
    recipe_servings: number
    lines: { ingredient: Ingredient; quantity_grams: number; quantity?: number; unit?: IngredientUnit }[]
  } | null
  ingredient: Ingredient | null
}

export function computePlanEntryDetailsTotals(entry: PlanEntryDetails): Totals {
  if (entry.entry_kind === 'eating_out') return { ...ZERO_TOTALS }

  if (entry.entry_kind === 'loose_ingredient') {
    if (!entry.ingredient || entry.exact_quantity == null || entry.exact_unit == null) {
      return { ...ZERO_TOTALS }
    }
    return computeLooseIngredientTotals(entry.ingredient, entry.exact_quantity, entry.exact_unit)
  }

  if (!entry.meal) return { ...ZERO_TOTALS }
  return computePlanEntryTotals(
    entry.meal.lines,
    entry,
    entry.meal.recipe_servings,
  )
}
