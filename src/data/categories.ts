import type { IngredientCategory, IngredientUnit } from '../types/database'

export const INGREDIENT_CATEGORIES: { value: IngredientCategory; label: string }[] = [
  { value: 'verdura', label: 'Verdura' },
  { value: 'fruta', label: 'Fruta' },
  { value: 'carne', label: 'Carne' },
  { value: 'pescado', label: 'Pescado' },
  { value: 'lacteo', label: 'Lácteo' },
  { value: 'huevo', label: 'Huevo' },
  { value: 'cereal_pan', label: 'Cereal / Pan' },
  { value: 'legumbre', label: 'Legumbre' },
  { value: 'grasa_aceite', label: 'Grasa / Aceite' },
  { value: 'fruto_seco', label: 'Fruto seco' },
  { value: 'bebida', label: 'Bebida' },
  { value: 'otros', label: 'Otros' },
]

export const CATEGORY_LABELS: Record<IngredientCategory, string> = Object.fromEntries(
  INGREDIENT_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<IngredientCategory, string>

export const INGREDIENT_UNITS: { value: IngredientUnit; label: string }[] = [
  { value: 'gramos', label: 'Gramos' },
  { value: 'unidad', label: 'Unidad' },
  { value: 'ml', label: 'Mililitros' },
]
