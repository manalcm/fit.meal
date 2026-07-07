import { supabase } from './supabase'
import type { Ingredient, Meal, MealType } from '../types/database'

export interface MealIngredientLine {
  ingredient_id: string
  quantity_grams: number
}

export interface MealLineWithIngredient {
  quantity_grams: number
  ingredient: Ingredient
}

export interface MealWithLines extends Meal {
  lines: MealLineWithIngredient[]
}

export interface MealInput {
  name: string
  meal_types: MealType[]
  photo_url: string | null
  notes: string | null
}

const MEAL_SELECT = '*, meal_ingredients(quantity_grams, ingredient:ingredients(*))'

interface RawMealRow extends Meal {
  meal_ingredients: MealLineWithIngredient[]
}

function toMealWithLines(row: RawMealRow): MealWithLines {
  const { meal_ingredients, ...meal } = row
  return { ...meal, lines: meal_ingredients ?? [] }
}

export async function listMeals(): Promise<MealWithLines[]> {
  const { data, error } = await supabase.from('meals').select(MEAL_SELECT).order('name')
  if (error) throw error
  return (data as unknown as RawMealRow[]).map(toMealWithLines)
}

export async function getMeal(id: string): Promise<MealWithLines> {
  const { data, error } = await supabase.from('meals').select(MEAL_SELECT).eq('id', id).single()
  if (error) throw error
  return toMealWithLines(data as unknown as RawMealRow)
}

export async function createMeal(input: MealInput, lines: MealIngredientLine[]): Promise<string> {
  const { data, error } = await supabase.from('meals').insert(input).select('id').single()
  if (error) throw error
  const mealId = data.id as string
  await replaceMealIngredients(mealId, lines)
  return mealId
}

export async function updateMeal(
  id: string,
  input: MealInput,
  lines: MealIngredientLine[],
): Promise<void> {
  const { error } = await supabase.from('meals').update(input).eq('id', id)
  if (error) throw error
  await replaceMealIngredients(id, lines)
}

async function replaceMealIngredients(mealId: string, lines: MealIngredientLine[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('meal_ingredients')
    .delete()
    .eq('meal_id', mealId)
  if (deleteError) throw deleteError

  if (lines.length === 0) return
  const { error: insertError } = await supabase.from('meal_ingredients').insert(
    lines.map((l) => ({
      meal_id: mealId,
      ingredient_id: l.ingredient_id,
      quantity_grams: l.quantity_grams,
    })),
  )
  if (insertError) throw insertError
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', id)
  if (error) throw error
}

export async function uploadMealPhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('meal-photos').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('meal-photos').getPublicUrl(path)
  return data.publicUrl
}
