export type IngredientCategory =
  | 'verdura'
  | 'fruta'
  | 'carne'
  | 'pescado'
  | 'lacteo'
  | 'huevo'
  | 'cereal_pan'
  | 'legumbre'
  | 'grasa_aceite'
  | 'fruto_seco'
  | 'bebida'
  | 'otros'

export type IngredientUnit = 'gramos' | 'unidad' | 'ml'

// Centralizado aquí para poder añadir franjas nuevas (ej. media_manana)
// sin tocar el resto del código.
export const MEAL_TYPES = ['desayuno', 'almuerzo', 'cena', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export interface Ingredient {
  id: string
  name: string
  category: IngredientCategory
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  price_per_kg: number | null
  default_unit: IngredientUnit
  grams_per_unit: number | null
  in_pantry: boolean
  created_at: string
}

export interface Meal {
  id: string
  name: string
  meal_types: MealType[]
  photo_url: string | null
  notes: string | null
  created_at: string
}

export interface MealIngredient {
  id: string
  meal_id: string
  ingredient_id: string
  quantity_grams: number
}

export interface Person {
  id: string
  name: string
  color: string
  target_kcal: number
  target_protein: number
  target_carbs: number
  target_fat: number
  target_water_ml: number
  created_at: string
}

export interface PlanEntry {
  id: string
  person_id: string
  date: string
  meal_type: MealType
  meal_id: string
  portion: number | null
  override_grams: number | null
  created_at: string
}
