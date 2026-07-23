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
export type PlanEntryKind = 'meal' | 'loose_ingredient' | 'eating_out'

// Centralizado aquí para poder añadir franjas nuevas (ej. media_manana)
// sin tocar el resto del código.
export const MEAL_TYPES = ['desayuno', 'almuerzo', 'cena', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export interface Ingredient {
  id: string
  household_id: string
  name: string
  category: IngredientCategory
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  /** Unidad a la que corresponden los valores nutricionales almacenados. */
  nutrition_unit: IngredientUnit
  price_per_kg: number | null
  default_unit: IngredientUnit
  grams_per_unit: number | null
  in_pantry: boolean
  package_price: number | null
  package_size: number | null
  package_unit: IngredientUnit | null
  created_at: string
}

export interface Meal {
  id: string
  household_id: string
  name: string
  meal_types: MealType[]
  photo_url: string | null
  notes: string | null
  recipe_servings: number
  created_at: string
}

export interface MealIngredient {
  id: string
  household_id: string
  meal_id: string
  ingredient_id: string
  quantity_grams: number
  quantity: number
  unit: IngredientUnit
}

export interface Person {
  id: string
  household_id: string
  name: string
  color: string
  target_kcal: number
  target_protein: number
  target_carbs: number
  target_fat: number
  target_water_ml: number
  show_water_tracking: boolean
  created_at: string
}

export interface LegacyPlanSnapshot {
  version: number
  source_mode: 'grams' | 'portion'
  meal_name: string
  original_portion: number | null
  original_override_grams: number | null
  factor: number | null
  totals: {
    kcal: number
    protein: number
    carbs: number
    fat: number
    cost: number
  }
  ingredients: { ingredient_id: string; quantity_grams: number }[]
}

export interface PlanEntry {
  id: string
  household_id: string
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
  legacy_snapshot: LegacyPlanSnapshot | null
  created_at: string
}
