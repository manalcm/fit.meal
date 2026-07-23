import type { MealType, Person } from '../types/database'
import type { MealWithLines } from './meals'
import type { PlanEntryWithDetails } from './planEntries'
import {
  computeMealPerServingTotals,
  computePlanEntryDetailsTotals,
  scaleTotals,
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

export const SURPRISE_DAY_SLOTS: MealType[] = ['desayuno', 'almuerzo', 'snack', 'cena']

export interface SurpriseDaySlot {
  mealType: MealType
  candidate: SurpriseCandidate | null
  occupiedPersonNames: string[]
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

/**
 * Construye el día en orden. Cada propuesta descuenta sus macros antes de
 * buscar la siguiente, de modo que el conjunto no puede pasarse del objetivo.
 */
export function chooseSurpriseDay(
  meals: MealWithLines[],
  people: Person[],
  currentPersonId: string,
  copyToHousehold: boolean,
  dayEntries: PlanEntryWithDetails[],
  random: () => number = Math.random,
): SurpriseDaySlot[] {
  const remaining = new Map(people.map((person) => [
    person.id,
    remainingMacrosForPerson(person, dayEntries),
  ]))

  return SURPRISE_DAY_SLOTS.map((mealType) => {
    const occupiedIds = new Set(
      dayEntries.filter((entry) => entry.meal_type === mealType).map((entry) => entry.person_id),
    )
    const targetPeople = copyToHousehold
      ? people.filter((person) => !occupiedIds.has(person.id))
      : people.filter((person) => person.id === currentPersonId && !occupiedIds.has(person.id))
    const occupiedPersonNames = people
      .filter((person) => occupiedIds.has(person.id))
      .map((person) => person.name)

    if (targetPeople.length === 0) return { mealType, candidate: null, occupiedPersonNames }

    const candidates = meals
      .filter((meal) => meal.meal_types.includes(mealType))
      .flatMap((meal) => {
        const perServing = computeMealPerServingTotals(meal.lines, meal.recipe_servings)
        const assignments: SurpriseAssignment[] = []
        for (const person of targetPeople) {
          const servings = servingThatFits(perServing, remaining.get(person.id)!)
          if (servings == null) return []
          assignments.push({ personId: person.id, personName: person.name, servings })
        }
        return [{ meal, assignments }]
      })
    const candidate = candidates.length === 0
      ? null
      : candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]

    if (candidate) {
      const perServing = computeMealPerServingTotals(candidate.meal.lines, candidate.meal.recipe_servings)
      for (const assignment of candidate.assignments) {
        const current = remaining.get(assignment.personId)!
        const used = scaleTotals(perServing, assignment.servings)
        remaining.set(assignment.personId, {
          kcal: current.kcal - used.kcal,
          protein: current.protein - used.protein,
          carbs: current.carbs - used.carbs,
          fat: current.fat - used.fat,
          cost: 0,
        })
      }
    }
    return { mealType, candidate, occupiedPersonNames }
  })
}
