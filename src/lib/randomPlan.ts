import type { MealType, Person } from '../types/database'
import type { MealWithLines } from './meals'
import type { PlanEntryWithDetails } from './planEntries'
import {
  computeMealPerServingTotals,
  computePlanEntryDetailsTotals,
  sumTotals,
  type Totals,
} from './calculations'

export interface SurpriseAssignment {
  personId: string
  personName: string
  servings: 0.5 | 1
}

export interface SurpriseCandidate {
  meal: MealWithLines
  assignments: SurpriseAssignment[]
}

export function remainingMacrosForPerson(
  person: Person,
  entries: PlanEntryWithDetails[],
): Totals {
  const consumed = sumTotals(
    entries
      .filter((entry) => entry.person_id === person.id)
      .map(computePlanEntryDetailsTotals),
  )
  return {
    kcal: person.target_kcal - consumed.kcal,
    protein: person.target_protein - consumed.protein,
    carbs: person.target_carbs - consumed.carbs,
    fat: person.target_fat - consumed.fat,
    cost: 0,
  }
}

function fits(totals: Totals, remaining: Totals): boolean {
  const epsilon = 0.000001
  return (
    totals.kcal <= remaining.kcal + epsilon &&
    totals.protein <= remaining.protein + epsilon &&
    totals.carbs <= remaining.carbs + epsilon &&
    totals.fat <= remaining.fat + epsilon
  )
}

function servingThatFits(perServing: Totals, remaining: Totals): 0.5 | 1 | null {
  if (fits(perServing, remaining)) return 1
  const half = {
    kcal: perServing.kcal * 0.5,
    protein: perServing.protein * 0.5,
    carbs: perServing.carbs * 0.5,
    fat: perServing.fat * 0.5,
    cost: perServing.cost * 0.5,
  }
  return fits(half, remaining) ? 0.5 : null
}

export function validSurpriseCandidates(
  meals: MealWithLines[],
  mealType: MealType,
  people: Person[],
  dayEntries: PlanEntryWithDetails[],
): SurpriseCandidate[] {
  if (people.length === 0) return []

  return meals
    .filter((meal) => meal.meal_types.includes(mealType))
    .flatMap((meal) => {
      const perServing = computeMealPerServingTotals(meal.lines, meal.recipe_servings)
      const assignments: SurpriseAssignment[] = []
      for (const person of people) {
        const servings = servingThatFits(
          perServing,
          remainingMacrosForPerson(person, dayEntries),
        )
        if (servings == null) return []
        assignments.push({ personId: person.id, personName: person.name, servings })
      }
      return [{ meal, assignments }]
    })
}

export function chooseSurpriseCandidate(
  meals: MealWithLines[],
  mealType: MealType,
  people: Person[],
  dayEntries: PlanEntryWithDetails[],
  random: () => number = Math.random,
): SurpriseCandidate | null {
  const candidates = validSurpriseCandidates(meals, mealType, people, dayEntries)
  if (candidates.length === 0) return null
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
  return candidates[index]
}
