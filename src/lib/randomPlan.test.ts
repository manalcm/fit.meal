import { describe, expect, it } from 'vitest'
import {
  chooseSurpriseCandidate,
  chooseSurpriseDay,
  remainingMacrosForPerson,
  validSurpriseCandidates,
} from './randomPlan'
import { makeIngredient, makePerson, makePlanEntry } from '../test/fixtures'
import type { MealWithLines } from './meals'

const ingredient = makeIngredient({
  kcal_per_100g: 400,
  protein_per_100g: 20,
  carbs_per_100g: 30,
  fat_per_100g: 10,
})

function meal(id: string, mealTypes: MealWithLines['meal_types']): MealWithLines {
  return {
    id,
    household_id: 'household-1',
    name: id,
    meal_types: mealTypes,
    photo_url: null,
    notes: null,
    recipe_servings: 1,
    created_at: '2026-07-22T00:00:00Z',
    lines: [{ ingredient, quantity_grams: 100 }],
  }
}

describe('Sorpréndeme por macros restantes', () => {
  it('filtra por la franja seleccionada y no consulta la despensa', () => {
    const snack = meal('Merienda válida', ['snack'])
    const dinner = meal('Cena', ['cena'])
    const person = makePerson()
    expect(validSurpriseCandidates([snack, dinner], 'snack', [person], [])).toHaveLength(1)
    expect(
      validSurpriseCandidates(
        [
          {
            ...snack,
            lines: [{ ingredient: { ...ingredient, in_pantry: false }, quantity_grams: 100 }],
          },
        ],
        'snack',
        [person],
        [],
      ),
    ).toHaveLength(1)
  })

  it('propone 1 ración si encaja y 0,5 si una completa supera algún macro', () => {
    const recipe = meal('Plato', ['almuerzo'])
    const oneServing = makePerson({
      id: 'person-1',
      name: 'Una ración',
      target_kcal: 500,
      target_protein: 25,
      target_carbs: 35,
      target_fat: 12,
    })
    const halfServing = makePerson({
      id: 'person-2',
      name: 'Media ración',
      target_kcal: 250,
      target_protein: 12,
      target_carbs: 20,
      target_fat: 6,
    })
    const candidate = chooseSurpriseCandidate(
      [recipe],
      'almuerzo',
      [oneServing, halfServing],
      [],
    )
    expect(candidate?.assignments).toEqual([
      { personId: 'person-1', personName: 'Una ración', servings: 1 },
      { personId: 'person-2', personName: 'Media ración', servings: 0.5 },
    ])
  })

  it('rechaza un plato si también media ración supera proteína, carbohidratos o grasa', () => {
    const restrictive = makePerson({
      target_kcal: 1000,
      target_protein: 9,
      target_carbs: 100,
      target_fat: 100,
    })
    expect(chooseSurpriseCandidate([meal('Plato', ['almuerzo'])], 'almuerzo', [restrictive], [])).toBeNull()
  })

  it('resta lo ya planificado antes de evaluar cada macro', () => {
    const person = makePerson({
      target_kcal: 1000,
      target_protein: 100,
      target_carbs: 100,
      target_fat: 100,
    })
    const entry = makePlanEntry({ person_id: person.id })
    expect(remainingMacrosForPerson(person, [entry])).toEqual({
      kcal: 700,
      protein: 80,
      carbs: 70,
      fat: 90,
      cost: 0,
    })
  })

  it('elige solo entre los platos válidos usando la selección aleatoria inyectada', () => {
    const person = makePerson()
    const first = meal('Primero', ['desayuno'])
    const second = meal('Segundo', ['desayuno'])
    expect(chooseSurpriseCandidate([first, second], 'desayuno', [person], [], () => 0)?.meal.id).toBe('Primero')
    expect(chooseSurpriseCandidate([first, second], 'desayuno', [person], [], () => 0.999)?.meal.id).toBe('Segundo')
  })

  it('construye el día en orden sin superar los macros acumulados', () => {
    const person = makePerson({ target_kcal: 600, target_protein: 100, target_carbs: 100, target_fat: 100 })
    const slots = chooseSurpriseDay([meal('Desayuno', ['desayuno']), meal('Comida', ['almuerzo'])], [person], person.id, false, [], () => 0)
    expect(slots[0].candidate?.meal.name).toBe('Desayuno')
    expect(slots[1].candidate?.meal.name).toBe('Comida')
  })
})
