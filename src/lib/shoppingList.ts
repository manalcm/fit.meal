import { supabase } from './supabase'
import { round1 } from './calculations'
import type {
  Ingredient,
  IngredientCategory,
  IngredientUnit,
  LegacyPlanSnapshot,
  PlanEntryKind,
} from '../types/database'
import { requireActiveHouseholdId } from './householdScope'

export interface ShoppingListItem {
  key: string
  ingredient: Ingredient
  unit: IngredientUnit
  neededQuantity: number
  packageCount: number | null
  purchasedQuantity: number | null
  consumedCost: number | null
  purchaseCost: number | null
  missingPrice: boolean
  missingPackageSize: boolean
  missingPackageUnit: boolean
  incompatiblePackageUnit: boolean
}

export interface ShoppingListSummary {
  consumedTotal: number
  purchaseTotal: number
  missingPriceCount: number
  missingPackageSizeCount: number
  incompleteIngredientCount: number
  isComplete: boolean
}

export interface BudgetComparison {
  budget: number
  purchaseTotal: number
  remaining: number
  excess: number
  progressPercent: number
  isPartial: boolean
  incompleteIngredientCount: number
}

export interface PlanEntryForShopping {
  entry_kind: PlanEntryKind
  exact_quantity: number | null
  exact_unit: IngredientUnit | null
  planned_servings: number | null
  portion: number | null
  override_grams: number | null
  legacy_snapshot: LegacyPlanSnapshot | null
  ingredient: Ingredient | null
  meal: {
    recipe_servings: number
    meal_ingredients: { quantity_grams: number; ingredient: Ingredient }[]
  } | null
}

export interface IngredientRequirement {
  ingredient: Ingredient
  quantity: number
  unit: IngredientUnit
}

const LIST_SELECT =
  'entry_kind, exact_quantity, exact_unit, planned_servings, portion, override_grams, legacy_snapshot, ingredient:ingredients(*), meal:meals(recipe_servings, meal_ingredients(quantity_grams, ingredient:ingredients(*)))'

function isPositive(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value > 0
}

export function calculateShoppingItem(
  ingredient: Ingredient,
  unit: IngredientUnit,
  neededQuantity: number,
): ShoppingListItem {
  const missingPrice = !isPositive(ingredient.package_price)
  const missingPackageSize = !isPositive(ingredient.package_size)
  const missingPackageUnit = ingredient.package_unit == null
  const incompatiblePackageUnit =
    ingredient.package_unit != null && ingredient.package_unit !== unit
  const canCalculatePackages =
    !missingPrice &&
    !missingPackageSize &&
    !missingPackageUnit &&
    !incompatiblePackageUnit

  const packageCount = canCalculatePackages
    ? Math.ceil(neededQuantity / ingredient.package_size!)
    : null
  const purchasedQuantity =
    packageCount == null ? null : packageCount * ingredient.package_size!
  const purchaseCost =
    packageCount == null ? null : packageCount * ingredient.package_price!

  let consumedCost: number | null = null
  if (
    !missingPrice &&
    !missingPackageSize &&
    !missingPackageUnit &&
    !incompatiblePackageUnit
  ) {
    consumedCost = (neededQuantity / ingredient.package_size!) * ingredient.package_price!
  } else if (unit === 'gramos' && isPositive(ingredient.price_per_kg)) {
    consumedCost = (neededQuantity / 1000) * ingredient.price_per_kg
  }

  return {
    key: `${ingredient.id}:${unit}`,
    ingredient,
    unit,
    neededQuantity,
    packageCount,
    purchasedQuantity,
    consumedCost,
    purchaseCost,
    missingPrice,
    missingPackageSize,
    missingPackageUnit,
    incompatiblePackageUnit,
  }
}

export function aggregateRequirements(
  requirements: IngredientRequirement[],
): ShoppingListItem[] {
  const totals = new Map<
    string,
    { ingredient: Ingredient; unit: IngredientUnit; quantity: number }
  >()

  for (const requirement of requirements) {
    if (!Number.isFinite(requirement.quantity) || requirement.quantity <= 0) continue
    const key = `${requirement.ingredient.id}:${requirement.unit}`
    const existing = totals.get(key)
    if (existing) {
      existing.quantity += requirement.quantity
    } else {
      totals.set(key, { ...requirement })
    }
  }

  return Array.from(totals.values())
    .map(({ ingredient, unit, quantity }) =>
      calculateShoppingItem(ingredient, unit, quantity),
    )
    .sort((a, b) => {
      const byName = a.ingredient.name.localeCompare(b.ingredient.name, 'es')
      return byName !== 0 ? byName : a.unit.localeCompare(b.unit)
    })
}

export function summarizeShoppingList(items: ShoppingListItem[]): ShoppingListSummary {
  const missingPriceIds = new Set<string>()
  const missingSizeIds = new Set<string>()
  const incompleteIds = new Set<string>()
  let consumedTotal = 0
  let purchaseTotal = 0

  for (const item of items) {
    if (item.consumedCost != null) consumedTotal += item.consumedCost
    if (item.purchaseCost != null) purchaseTotal += item.purchaseCost
    if (item.missingPrice) missingPriceIds.add(item.ingredient.id)
    if (item.missingPackageSize || item.missingPackageUnit) {
      missingSizeIds.add(item.ingredient.id)
    }
    if (
      item.missingPrice ||
      item.missingPackageSize ||
      item.missingPackageUnit ||
      item.incompatiblePackageUnit
    ) {
      incompleteIds.add(item.ingredient.id)
    }
  }

  return {
    consumedTotal,
    purchaseTotal,
    missingPriceCount: missingPriceIds.size,
    missingPackageSizeCount: missingSizeIds.size,
    incompleteIngredientCount: incompleteIds.size,
    isComplete: incompleteIds.size === 0,
  }
}

export function compareShoppingBudget(
  budget: number | null,
  summary: ShoppingListSummary,
): BudgetComparison | null {
  if (budget == null) return null
  const purchaseTotal = Math.round(summary.purchaseTotal * 100) / 100
  const difference = Math.round((budget - purchaseTotal) * 100) / 100
  return {
    budget,
    purchaseTotal,
    remaining: Math.max(0, difference),
    excess: Math.max(0, -difference),
    progressPercent:
      budget === 0
        ? purchaseTotal > 0
          ? 100
          : 0
        : Math.min(100, (purchaseTotal / budget) * 100),
    isPartial: !summary.isComplete,
    incompleteIngredientCount: summary.incompleteIngredientCount,
  }
}

export function requirementsFromPlanEntries(
  rows: PlanEntryForShopping[],
  ingredientLookup: Map<string, Ingredient> = new Map(),
): IngredientRequirement[] {
  const requirements: IngredientRequirement[] = []
  const addRequirement = (
    ingredient: Ingredient,
    quantity: number,
    unit: IngredientUnit,
  ) => {
    if (quantity > 0) requirements.push({ ingredient, quantity, unit })
  }

  for (const row of rows) {
    if (row.entry_kind === 'eating_out') continue

    if (row.entry_kind === 'loose_ingredient') {
      if (row.ingredient && row.exact_quantity != null && row.exact_unit != null) {
        addRequirement(row.ingredient, row.exact_quantity, row.exact_unit)
      }
      continue
    }

    if (!row.meal) continue
    if (row.planned_servings == null && row.legacy_snapshot?.ingredients) {
      for (const item of row.legacy_snapshot.ingredients) {
        const ingredient = ingredientLookup.get(item.ingredient_id)
        if (ingredient) addRequirement(ingredient, item.quantity_grams, 'gramos')
      }
      continue
    }

    const lines = row.meal.meal_ingredients
    const baseGrams = lines.reduce((sum, line) => sum + line.quantity_grams, 0)
    let factor = 0
    if (row.planned_servings != null && row.meal.recipe_servings > 0) {
      factor = row.planned_servings / row.meal.recipe_servings
    } else if (row.portion != null) {
      factor = row.portion
    } else if (row.override_grams != null && baseGrams > 0) {
      factor = row.override_grams / baseGrams
    }
    if (factor <= 0) continue

    for (const line of lines) {
      addRequirement(line.ingredient, line.quantity_grams * factor, 'gramos')
    }
  }

  return requirements
}

/** Agrega las necesidades exactas de todas las personas entre dos fechas. */
export async function buildShoppingList(
  startISO: string,
  endISO: string,
): Promise<ShoppingListItem[]> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .select(LIST_SELECT)
    .eq('household_id', householdId)
    .gte('date', startISO)
    .lte('date', endISO)
  if (error) throw error

  const rows = (data ?? []) as unknown as PlanEntryForShopping[]
  const ingredientLookup = new Map<string, Ingredient>()
  for (const row of rows) {
    if (row.ingredient) ingredientLookup.set(row.ingredient.id, row.ingredient)
    for (const line of row.meal?.meal_ingredients ?? []) {
      ingredientLookup.set(line.ingredient.id, line.ingredient)
    }
  }

  const legacyIngredientIds = new Set(
    rows
      .filter((row) => row.entry_kind === 'meal' && row.planned_servings == null)
      .flatMap((row) => row.legacy_snapshot?.ingredients ?? [])
      .map((item) => item.ingredient_id)
      .filter((id) => !ingredientLookup.has(id)),
  )

  if (legacyIngredientIds.size > 0) {
    const { data: legacyIngredients, error: ingredientError } = await supabase
      .from('ingredients')
      .select('*')
      .eq('household_id', householdId)
      .in('id', Array.from(legacyIngredientIds))
    if (ingredientError) throw ingredientError
    for (const ingredient of (legacyIngredients ?? []) as Ingredient[]) {
      ingredientLookup.set(ingredient.id, ingredient)
    }
  }

  return aggregateRequirements(requirementsFromPlanEntries(rows, ingredientLookup))
}

export function splitPantry(items: ShoppingListItem[]): {
  toBuy: ShoppingListItem[]
  inPantry: ShoppingListItem[]
} {
  return {
    toBuy: items.filter((item) => !item.ingredient.in_pantry),
    inPantry: items.filter((item) => item.ingredient.in_pantry),
  }
}

export function groupByCategory(
  items: ShoppingListItem[],
  order: IngredientCategory[],
): { category: IngredientCategory; items: ShoppingListItem[] }[] {
  const map = new Map<IngredientCategory, ShoppingListItem[]>()
  for (const item of items) {
    const entries = map.get(item.ingredient.category) ?? []
    entries.push(item)
    map.set(item.ingredient.category, entries)
  }
  return order
    .filter((category) => map.has(category))
    .map((category) => ({ category, items: map.get(category)! }))
}

function formatDecimal(value: number): string {
  return round1(value).toLocaleString('es-ES', { maximumFractionDigits: 1 })
}

export function formatShoppingAmount(quantity: number, unit: IngredientUnit): string {
  if (unit === 'unidad') {
    return `${formatDecimal(quantity)} ${round1(quantity) === 1 ? 'unidad' : 'unidades'}`
  }
  if (unit === 'ml') {
    return quantity >= 1000 ? `${formatDecimal(quantity / 1000)} L` : `${formatDecimal(quantity)} ml`
  }
  return quantity >= 1000 ? `${formatDecimal(quantity / 1000)} kg` : `${formatDecimal(quantity)} g`
}

export function formatPackageLine(item: ShoppingListItem): string | null {
  if (
    item.packageCount == null ||
    item.ingredient.package_size == null ||
    item.ingredient.package_unit == null
  ) {
    return null
  }
  const noun = item.packageCount === 1 ? 'envase' : 'envases'
  return `${item.packageCount} ${noun} de ${formatShoppingAmount(
    item.ingredient.package_size,
    item.ingredient.package_unit,
  )}`
}
