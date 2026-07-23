import type { IngredientCategory, IngredientUnit } from '../types/database'

export interface BasicIngredient {
  name: string
  category: IngredientCategory
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  price_per_kg: number | null
  default_unit: IngredientUnit
  grams_per_unit: number | null
  package_price?: number | null
  package_size?: number | null
  package_unit?: IngredientUnit | null
}

// 25 básicos españoles para arrancar sin tener que rellenar nada a mano.
export const BASIC_INGREDIENTS: BasicIngredient[] = [
  { name: 'Huevo', category: 'huevo', kcal_per_100g: 155, protein_per_100g: 13, carbs_per_100g: 1.1, fat_per_100g: 11, price_per_kg: 3.5, default_unit: 'unidad', grams_per_unit: 60 },
  { name: 'Pechuga de pollo', category: 'carne', kcal_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, price_per_kg: 6.5, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Arroz blanco', category: 'cereal_pan', kcal_per_100g: 349, protein_per_100g: 7.1, carbs_per_100g: 78, fat_per_100g: 0.6, price_per_kg: 1.2, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Pasta', category: 'cereal_pan', kcal_per_100g: 353, protein_per_100g: 12.5, carbs_per_100g: 71.2, fat_per_100g: 1.5, price_per_kg: 1.3, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Pan blanco', category: 'cereal_pan', kcal_per_100g: 265, protein_per_100g: 9, carbs_per_100g: 49, fat_per_100g: 3.2, price_per_kg: 2.5, default_unit: 'gramos', grams_per_unit: 30 },
  { name: 'Avena en copos', category: 'cereal_pan', kcal_per_100g: 372, protein_per_100g: 13.5, carbs_per_100g: 61.9, fat_per_100g: 6.9, price_per_kg: 2.2, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Patata', category: 'verdura', kcal_per_100g: 77, protein_per_100g: 2, carbs_per_100g: 17, fat_per_100g: 0.1, price_per_kg: 1, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Plátano', category: 'fruta', kcal_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 22.8, fat_per_100g: 0.3, price_per_kg: 1.4, default_unit: 'unidad', grams_per_unit: 120 },
  { name: 'Manzana', category: 'fruta', kcal_per_100g: 52, protein_per_100g: 0.3, carbs_per_100g: 13.8, fat_per_100g: 0.2, price_per_kg: 1.8, default_unit: 'unidad', grams_per_unit: 150 },
  { name: 'Tomate', category: 'verdura', kcal_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.9, fat_per_100g: 0.2, price_per_kg: 2, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Cebolla', category: 'verdura', kcal_per_100g: 40, protein_per_100g: 1.1, carbs_per_100g: 9.3, fat_per_100g: 0.1, price_per_kg: 1, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Zanahoria', category: 'verdura', kcal_per_100g: 41, protein_per_100g: 0.9, carbs_per_100g: 9.6, fat_per_100g: 0.2, price_per_kg: 1, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Brócoli', category: 'verdura', kcal_per_100g: 34, protein_per_100g: 2.8, carbs_per_100g: 6.6, fat_per_100g: 0.4, price_per_kg: 2.5, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Espinacas', category: 'verdura', kcal_per_100g: 23, protein_per_100g: 2.9, carbs_per_100g: 3.6, fat_per_100g: 0.4, price_per_kg: 3, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Aceite de oliva virgen extra', category: 'grasa_aceite', kcal_per_100g: 884, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 100, price_per_kg: 6, default_unit: 'ml', grams_per_unit: null },
  { name: 'Leche entera', category: 'lacteo', kcal_per_100g: 61, protein_per_100g: 3.2, carbs_per_100g: 4.8, fat_per_100g: 3.3, price_per_kg: 1, default_unit: 'ml', grams_per_unit: null },
  { name: 'Yogur natural', category: 'lacteo', kcal_per_100g: 61, protein_per_100g: 3.5, carbs_per_100g: 4.7, fat_per_100g: 3.3, price_per_kg: 2.5, default_unit: 'unidad', grams_per_unit: 125 },
  { name: 'Queso fresco batido', category: 'lacteo', kcal_per_100g: 98, protein_per_100g: 11, carbs_per_100g: 3.4, fat_per_100g: 4.3, price_per_kg: 4, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Atún en lata al natural', category: 'pescado', kcal_per_100g: 116, protein_per_100g: 25.5, carbs_per_100g: 0, fat_per_100g: 1, price_per_kg: 9, default_unit: 'unidad', grams_per_unit: 80 },
  { name: 'Salmón', category: 'pescado', kcal_per_100g: 208, protein_per_100g: 20, carbs_per_100g: 0, fat_per_100g: 13, price_per_kg: 14, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Garbanzos cocidos', category: 'legumbre', kcal_per_100g: 164, protein_per_100g: 8.9, carbs_per_100g: 27.4, fat_per_100g: 2.6, price_per_kg: 2, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Lentejas cocidas', category: 'legumbre', kcal_per_100g: 116, protein_per_100g: 9, carbs_per_100g: 20, fat_per_100g: 0.4, price_per_kg: 2, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Almendras', category: 'fruto_seco', kcal_per_100g: 579, protein_per_100g: 21.2, carbs_per_100g: 21.6, fat_per_100g: 49.9, price_per_kg: 12, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Nueces', category: 'fruto_seco', kcal_per_100g: 654, protein_per_100g: 15.2, carbs_per_100g: 13.7, fat_per_100g: 65.2, price_per_kg: 11, default_unit: 'gramos', grams_per_unit: null },
  { name: 'Miel', category: 'otros', kcal_per_100g: 304, protein_per_100g: 0.3, carbs_per_100g: 82.4, fat_per_100g: 0, price_per_kg: 8, default_unit: 'gramos', grams_per_unit: null },
]
