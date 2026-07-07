import { MEAL_TYPES, type MealType } from '../types/database'

export { MEAL_TYPES }

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Comida',
  cena: 'Cena',
  snack: 'Snack',
}

export const MEAL_TYPE_TAG_COLORS: Record<MealType, string> = {
  desayuno: 'var(--color-sage)',
  almuerzo: 'var(--color-accent)',
  cena: 'var(--color-brick)',
  snack: 'var(--color-gold)',
}
