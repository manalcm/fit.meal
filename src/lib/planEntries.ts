import { supabase } from './supabase'
import type {
  Ingredient,
  IngredientUnit,
  LegacyPlanSnapshot,
  MealType,
  PlanEntry,
  PlanEntryKind,
} from '../types/database'
import type { MealWithLines } from './meals'
import { toISODate, addDays, fromISODate } from './dates'
import { requireActiveHouseholdId } from './householdScope'
import { isHalfServingStep } from './calculations'
import type { ServingPatch } from './servings'

export interface PlanEntryWithDetails extends PlanEntry {
  meal: MealWithLines | null
  ingredient: Ingredient | null
}

export interface PlanEntryInput {
  person_id: string
  date: string
  meal_type: MealType
  entry_kind: PlanEntryKind
  meal_id: string | null
  ingredient_id: string | null
  exact_quantity: number | null
  exact_unit: IngredientUnit | null
  planned_servings: number | null
  portion: number | null
  override_grams: number | null
  legacy_snapshot?: LegacyPlanSnapshot | null
}

export interface HouseholdPlanResult {
  source_id: string
  copy_ids: string[]
  copied_person_ids: string[]
  skipped: { person_id: string; name: string }[]
}

export interface SurprisePlanResult {
  created: { id: string; person_id: string }[]
  skipped: { person_id: string; name: string }[]
}

interface HouseholdPlanBase {
  sourcePersonId: string
  date: string
  mealType: MealType
  copyToHousehold: boolean
}

export type HouseholdPlanInput =
  | (HouseholdPlanBase & {
      kind: 'meal'
      mealId: string
      plannedServings: number
    })
  | (HouseholdPlanBase & {
      kind: 'loose_ingredient'
      ingredientId: string
      exactQuantity: number
      exactUnit: IngredientUnit
    })

const ENTRY_SELECT =
  '*, meal:meals(*, meal_ingredients(quantity_grams, ingredient:ingredients(*))), ingredient:ingredients(*)'

interface RawEntryRow extends PlanEntry {
  meal: (MealWithLines & { meal_ingredients: MealWithLines['lines'] }) | null
  ingredient: Ingredient | null
}

function toEntryWithDetails(row: RawEntryRow): PlanEntryWithDetails {
  let meal: MealWithLines | null = null
  if (row.meal) {
    const { meal_ingredients, ...mealRow } = row.meal
    meal = {
      ...mealRow,
      recipe_servings: mealRow.recipe_servings ?? 1,
      lines: meal_ingredients ?? [],
    }
  }

  return {
    ...row,
    entry_kind: row.entry_kind ?? 'meal',
    ingredient_id: row.ingredient_id ?? null,
    exact_quantity: row.exact_quantity ?? null,
    exact_unit: row.exact_unit ?? null,
    planned_servings: row.planned_servings ?? null,
    legacy_snapshot: row.legacy_snapshot ?? null,
    meal,
    ingredient: row.ingredient ?? null,
  }
}

export async function listPlanEntries(
  personId: string,
  startISO: string,
  endISO: string,
): Promise<PlanEntryWithDetails[]> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .select(ENTRY_SELECT)
    .eq('household_id', householdId)
    .eq('person_id', personId)
    .gte('date', startISO)
    .lte('date', endISO)
  if (error) throw error
  return (data as unknown as RawEntryRow[]).map(toEntryWithDetails)
}

export async function listHouseholdPlanEntries(
  startISO: string,
  endISO: string,
): Promise<PlanEntryWithDetails[]> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .select(ENTRY_SELECT)
    .eq('household_id', householdId)
    .gte('date', startISO)
    .lte('date', endISO)
  if (error) throw error
  return (data as unknown as RawEntryRow[]).map(toEntryWithDetails)
}

/** Inserción directa conservada para copias de día/semana y el recomendador actual. */
export async function createPlanEntry(input: PlanEntryInput): Promise<PlanEntry> {
  const householdId = requireActiveHouseholdId()
  if (input.planned_servings != null && !isHalfServingStep(input.planned_servings)) {
    throw new Error('Las raciones deben ser 0,5 o un múltiplo positivo de 0,5.')
  }
  const { data, error } = await supabase
    .from('plan_entries')
    .insert({ ...input, household_id: householdId })
    .select()
    .single()
  if (error) throw error
  return data as PlanEntry
}

export async function createHouseholdPlanItem(
  input: HouseholdPlanInput,
): Promise<HouseholdPlanResult> {
  if (input.kind === 'meal' && !isHalfServingStep(input.plannedServings)) {
    throw new Error('Las raciones deben ser 0,5 o un múltiplo positivo de 0,5.')
  }
  if (input.kind === 'loose_ingredient' && (!Number.isFinite(input.exactQuantity) || input.exactQuantity <= 0)) {
    throw new Error('La cantidad debe ser mayor que cero.')
  }

  const { data, error } = await supabase.rpc('add_plan_item_with_household_copies', {
    p_source_person_id: input.sourcePersonId,
    p_date: input.date,
    p_meal_type: input.mealType,
    p_entry_kind: input.kind,
    p_meal_id: input.kind === 'meal' ? input.mealId : null,
    p_ingredient_id: input.kind === 'loose_ingredient' ? input.ingredientId : null,
    p_exact_quantity: input.kind === 'loose_ingredient' ? input.exactQuantity : null,
    p_exact_unit: input.kind === 'loose_ingredient' ? input.exactUnit : null,
    p_planned_servings: input.kind === 'meal' ? input.plannedServings : null,
    p_copy_to_household: input.copyToHousehold,
  })
  if (error) throw error
  return data as HouseholdPlanResult
}

export async function setEatingOutForPeople(
  personIds: string[],
  date: string,
  mealType: MealType,
  replaceExisting: boolean,
): Promise<{ created_ids: string[] }> {
  if (personIds.length === 0) throw new Error('Selecciona al menos una persona.')
  const { data, error } = await supabase.rpc('set_eating_out_for_people', {
    p_person_ids: personIds,
    p_date: date,
    p_meal_type: mealType,
    p_replace_existing: replaceExisting,
  })
  if (error) throw error
  return data as { created_ids: string[] }
}

export async function addSurprisePlanItems(
  mealId: string,
  date: string,
  mealType: MealType,
  assignments: { personId: string; servings: 0.5 | 1 }[],
): Promise<SurprisePlanResult> {
  if (assignments.length === 0) throw new Error('No hay personas con una franja disponible.')
  const { data, error } = await supabase.rpc('add_surprise_plan_items', {
    p_meal_id: mealId,
    p_date: date,
    p_meal_type: mealType,
    p_assignments: assignments.map((assignment) => ({
      person_id: assignment.personId,
      servings: assignment.servings,
    })),
  })
  if (error) throw error
  return data as SurprisePlanResult
}

export async function listOccupiedPersonIds(
  personIds: string[],
  date: string,
  mealType: MealType,
): Promise<string[]> {
  if (personIds.length === 0) return []
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .select('person_id')
    .eq('household_id', householdId)
    .eq('date', date)
    .eq('meal_type', mealType)
    .in('person_id', personIds)
  if (error) throw error
  return Array.from(new Set((data ?? []).map((row) => row.person_id as string)))
}

export async function updatePlanEntry(id: string, patch: ServingPatch): Promise<PlanEntry> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .update(patch)
    .eq('id', id)
    .eq('household_id', householdId)
    .select()
    .single()
  if (error) throw error
  return data as PlanEntry
}

export async function updateLoosePlanEntry(id: string, exactQuantity: number): Promise<PlanEntry> {
  if (!Number.isFinite(exactQuantity) || exactQuantity <= 0) {
    throw new Error('La cantidad debe ser mayor que cero.')
  }
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .update({ exact_quantity: exactQuantity })
    .eq('id', id)
    .eq('household_id', householdId)
    .eq('entry_kind', 'loose_ingredient')
    .select()
    .single()
  if (error) throw error
  return data as PlanEntry
}

export async function deletePlanEntry(id: string): Promise<void> {
  await deletePlanEntries([id])
}

export async function deletePlanEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const householdId = requireActiveHouseholdId()
  const { error } = await supabase
    .from('plan_entries')
    .delete()
    .eq('household_id', householdId)
    .in('id', ids)
  if (error) throw error
}

async function fetchRawEntries(personId: string, startISO: string, endISO: string) {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .select(
      'meal_type, entry_kind, meal_id, ingredient_id, exact_quantity, exact_unit, planned_servings, portion, override_grams, legacy_snapshot, date',
    )
    .eq('household_id', householdId)
    .eq('person_id', personId)
    .gte('date', startISO)
    .lte('date', endISO)
  if (error) throw error
  return data ?? []
}

async function deleteRange(personId: string, startISO: string, endISO: string) {
  const householdId = requireActiveHouseholdId()
  const { error } = await supabase
    .from('plan_entries')
    .delete()
    .eq('household_id', householdId)
    .eq('person_id', personId)
    .gte('date', startISO)
    .lte('date', endISO)
  if (error) throw error
}

/** Copia todas las entradas de un día a otro día, sustituyendo lo que hubiera en el destino. */
export async function copyDay(personId: string, fromISO: string, toISO: string): Promise<void> {
  const source = await fetchRawEntries(personId, fromISO, fromISO)
  await deleteRange(personId, toISO, toISO)
  if (source.length === 0) return
  const householdId = requireActiveHouseholdId()
  const rows = source.map((entry) => ({
    ...entry,
    household_id: householdId,
    person_id: personId,
    date: toISO,
  }))
  const { error } = await supabase.from('plan_entries').insert(rows)
  if (error) throw error
}

/** Copia una semana completa (7 días desde fromStartISO) a partir de toStartISO. */
export async function copyWeek(
  personId: string,
  fromStartISO: string,
  toStartISO: string,
): Promise<void> {
  const fromStart = fromISODate(fromStartISO)
  const toStart = fromISODate(toStartISO)
  const fromEndISO = toISODate(addDays(fromStart, 6))
  const toEndISO = toISODate(addDays(toStart, 6))

  const source = await fetchRawEntries(personId, fromStartISO, fromEndISO)
  await deleteRange(personId, toStartISO, toEndISO)
  if (source.length === 0) return
  const householdId = requireActiveHouseholdId()
  const offsetDays = Math.round((toStart.getTime() - fromStart.getTime()) / 86400000)

  const rows = source.map((entry) => ({
    ...entry,
    household_id: householdId,
    person_id: personId,
    date: toISODate(addDays(fromISODate(entry.date), offsetDays)),
  }))
  const { error } = await supabase.from('plan_entries').insert(rows)
  if (error) throw error
}
