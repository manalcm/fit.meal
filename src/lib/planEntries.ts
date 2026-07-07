import { supabase } from './supabase'
import type { PlanEntry, MealType } from '../types/database'
import type { MealWithLines } from './meals'
import { toISODate, addDays, fromISODate } from './dates'
import { requireActiveHouseholdId } from './householdScope'

export interface PlanEntryWithMeal extends PlanEntry {
  meal: MealWithLines
}

export interface PlanEntryInput {
  person_id: string
  date: string
  meal_type: MealType
  meal_id: string
  portion: number | null
  override_grams: number | null
}

const ENTRY_SELECT = '*, meal:meals(*, meal_ingredients(quantity_grams, ingredient:ingredients(*)))'

interface RawEntryRow extends PlanEntry {
  meal: MealWithLines & { meal_ingredients: MealWithLines['lines'] }
}

function toEntryWithMeal(row: RawEntryRow): PlanEntryWithMeal {
  const { meal_ingredients, ...meal } = row.meal
  return { ...row, meal: { ...meal, lines: meal_ingredients ?? [] } }
}

export async function listPlanEntries(
  personId: string,
  startISO: string,
  endISO: string,
): Promise<PlanEntryWithMeal[]> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .select(ENTRY_SELECT)
    .eq('household_id', householdId)
    .eq('person_id', personId)
    .gte('date', startISO)
    .lte('date', endISO)
  if (error) throw error
  return (data as unknown as RawEntryRow[]).map(toEntryWithMeal)
}

export async function createPlanEntry(input: PlanEntryInput): Promise<PlanEntry> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .insert({ ...input, household_id: householdId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlanEntry(
  id: string,
  patch: { portion: number | null; override_grams: number | null },
): Promise<PlanEntry> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .update(patch)
    .eq('id', id)
    .eq('household_id', householdId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePlanEntry(id: string): Promise<void> {
  const householdId = requireActiveHouseholdId()
  const { error } = await supabase.from('plan_entries').delete().eq('id', id).eq('household_id', householdId)
  if (error) throw error
}

async function fetchRawEntries(personId: string, startISO: string, endISO: string) {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('plan_entries')
    .select('meal_type, meal_id, portion, override_grams, date')
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
  const rows = source.map((e) => ({
    household_id: householdId,
    person_id: personId,
    date: toISO,
    meal_type: e.meal_type,
    meal_id: e.meal_id,
    portion: e.portion,
    override_grams: e.override_grams,
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
  const rows = source.map((e) => ({
    household_id: householdId,
    person_id: personId,
    date: toISODate(addDays(fromISODate(e.date), offsetDays)),
    meal_type: e.meal_type,
    meal_id: e.meal_id,
    portion: e.portion,
    override_grams: e.override_grams,
  }))
  const { error } = await supabase.from('plan_entries').insert(rows)
  if (error) throw error
}
