import type { MealWithLines } from './meals'
import { computeMealTotals } from './calculations'
import { MEAL_TYPES } from '../data/mealTypes'
import type { MealType } from '../types/database'

const SLOT_WEIGHTS: Record<MealType, number> = {
  desayuno: 0.25,
  almuerzo: 0.35,
  cena: 0.3,
  snack: 0.1,
}

export interface RandomPick {
  mealType: MealType
  meal: MealWithLines
}

export interface RandomDayResult {
  picks: RandomPick[]
  skipped: MealType[]
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Elige al azar un plato para cada franja del día sin que la suma de kcal
 * supere targetKcal. Reparte el presupuesto entre franjas según SLOT_WEIGHTS
 * y, si un plato no cabe en el reparto de su franja, prueba con lo que quede
 * de presupuesto global antes de dejar la franja sin asignar.
 */
export function generateRandomDay(meals: MealWithLines[], targetKcal: number): RandomDayResult {
  const picks: RandomPick[] = []
  const skipped: MealType[] = []
  let remainingBudget = targetKcal
  let remainingWeight = MEAL_TYPES.reduce((sum, mt) => sum + SLOT_WEIGHTS[mt], 0)

  for (const mealType of MEAL_TYPES) {
    const weight = SLOT_WEIGHTS[mealType]
    const slotBudget = remainingWeight > 0 ? remainingBudget * (weight / remainingWeight) : 0
    remainingWeight -= weight

    const candidates = shuffle(meals.filter((m) => m.meal_types.includes(mealType))).map((meal) => ({
      meal,
      kcal: computeMealTotals(meal.lines).kcal,
    }))

    const choice =
      candidates.find((c) => c.kcal <= slotBudget && c.kcal <= remainingBudget) ??
      candidates.find((c) => c.kcal <= remainingBudget)

    if (choice) {
      picks.push({ mealType, meal: choice.meal })
      remainingBudget -= choice.kcal
    } else if (candidates.length > 0) {
      skipped.push(mealType)
    }
  }

  return { picks, skipped }
}
