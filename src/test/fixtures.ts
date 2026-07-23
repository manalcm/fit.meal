import type { Ingredient, Person } from '../types/database'
import type { PlanEntryWithDetails } from '../lib/planEntries'

export function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'ingredient-1',
    household_id: 'household-1',
    name: 'Ingrediente de prueba',
    category: 'otros',
    kcal_per_100g: 1200,
    protein_per_100g: 80,
    carbs_per_100g: 120,
    fat_per_100g: 40,
    price_per_kg: 12,
    default_unit: 'gramos',
    grams_per_unit: null,
    in_pantry: false,
    package_price: null,
    package_size: null,
    package_unit: null,
    created_at: '2026-07-22T00:00:00Z',
    ...overrides,
  }
}

export function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'person-1',
    household_id: 'household-1',
    name: 'Persona de prueba',
    color: '#7E9468',
    target_kcal: 2000,
    target_protein: 100,
    target_carbs: 200,
    target_fat: 70,
    target_water_ml: 2000,
    show_water_tracking: true,
    created_at: '2026-07-22T00:00:00Z',
    ...overrides,
  }
}

export function makePlanEntry(overrides: Partial<PlanEntryWithDetails> = {}): PlanEntryWithDetails {
  const ingredient = makeIngredient()
  return {
    id: 'entry-1',
    household_id: 'household-1',
    person_id: 'person-1',
    date: '2026-07-22',
    meal_type: 'almuerzo',
    entry_kind: 'meal',
    meal_id: 'meal-1',
    ingredient_id: null,
    exact_quantity: null,
    exact_unit: null,
    planned_servings: 1,
    portion: 1,
    override_grams: null,
    legacy_snapshot: null,
    created_at: '2026-07-22T00:00:00Z',
    meal: {
      id: 'meal-1',
      household_id: 'household-1',
      name: 'Receta de prueba',
      meal_types: ['almuerzo'],
      photo_url: null,
      notes: null,
      recipe_servings: 4,
      created_at: '2026-07-22T00:00:00Z',
      lines: [{ ingredient, quantity_grams: 100 }],
    },
    ingredient: null,
    ...overrides,
  }
}
