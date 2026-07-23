import { describe, expect, it } from 'vitest'
import {
  clampServingStep,
  computeMealPerServingTotals,
  computeMealTotals,
  computeLooseIngredientTotals,
  computePlanEntryDetailsTotals,
  computePlanEntryTotals,
  ingredientQuantityPerServing,
  isHalfServingStep,
} from './calculations'
import { makeIngredient, makePlanEntry } from '../test/fixtures'

const ingredient = makeIngredient()
const lines = [{ ingredient, quantity_grams: 100 }]

describe('cálculos por ración', () => {
  it('divide una receta de 1.200 kcal entre 4 raciones', () => {
    expect(computeMealTotals(lines).kcal).toBe(1200)
    expect(computeMealPerServingTotals(lines, 4).kcal).toBe(300)
    expect(ingredientQuantityPerServing(100, 4)).toBe(25)
  })

  it('calcula 1 y 1,5 raciones sin tratar la receta completa como una ración', () => {
    const entry = makePlanEntry()
    expect(computePlanEntryTotals(lines, entry, 4).kcal).toBe(300)
    expect(
      computePlanEntryTotals(lines, { ...entry, planned_servings: 1.5, portion: 1.5 }, 4).kcal,
    ).toBe(450)
  })

  it('conserva la instantánea de una planificación antigua aunque cambie la receta', () => {
    const legacy = makePlanEntry({
      planned_servings: null,
      portion: null,
      override_grams: 37,
      legacy_snapshot: {
        version: 1,
        source_mode: 'grams',
        meal_name: 'Receta anterior',
        original_portion: null,
        original_override_grams: 37,
        factor: 0.37,
        totals: { kcal: 444, protein: 12, carbs: 22, fat: 8, cost: 1.25 },
        ingredients: [{ ingredient_id: ingredient.id, quantity_grams: 37 }],
      },
    })

    expect(
      computePlanEntryTotals([{ ingredient: { ...ingredient, kcal_per_100g: 9999 }, quantity_grams: 900 }], legacy, 4),
    ).toEqual({ kcal: 444, protein: 12, carbs: 22, fat: 8, cost: 1.25 })
  })

  it('solo acepta incrementos positivos de media ración', () => {
    expect(isHalfServingStep(0.5)).toBe(true)
    expect(isHalfServingStep(2)).toBe(true)
    expect(isHalfServingStep(0)).toBe(false)
    expect(isHalfServingStep(-0.5)).toBe(false)
    expect(isHalfServingStep(0.75)).toBe(false)
    expect(clampServingStep(0)).toBe(0.5)
  })
})

describe('alimentos sueltos y Comemos fuera', () => {
  it('conserva cantidades exactas en gramos y mililitros', () => {
    const grams = makeIngredient({ kcal_per_100g: 100, default_unit: 'gramos' })
    const millilitres = makeIngredient({ kcal_per_100g: 60, default_unit: 'ml' })
    expect(computeLooseIngredientTotals(grams, 125.5, 'gramos').kcal).toBeCloseTo(125.5)
    expect(computeLooseIngredientTotals(millilitres, 250, 'ml').kcal).toBeCloseTo(150)
  })

  it('calcula el coste consumido desde el envase sin convertir unidades', () => {
    const milk = makeIngredient({
      default_unit: 'ml',
      package_unit: 'ml',
      package_size: 1000,
      package_price: 1,
      price_per_kg: null,
    })
    const eggs = makeIngredient({
      default_unit: 'unidad',
      grams_per_unit: 60,
      package_unit: 'unidad',
      package_size: 12,
      package_price: 2.4,
    })

    expect(computeLooseIngredientTotals(milk, 250, 'ml').cost).toBeCloseTo(0.25)
    expect(computeLooseIngredientTotals(eggs, 2, 'unidad').cost).toBeCloseTo(0.4)
    expect(computeLooseIngredientTotals(milk, 250, 'gramos').cost).toBe(0)
  })
  it('convierte unidades solo con el peso explícito configurado', () => {
    const egg = makeIngredient({
      kcal_per_100g: 100,
      default_unit: 'unidad',
      grams_per_unit: 60,
    })
    expect(computeLooseIngredientTotals(egg, 2, 'unidad').kcal).toBe(120)
    expect(computeLooseIngredientTotals(egg, 2, 'gramos').kcal).toBe(0)
    expect(
      computeLooseIngredientTotals({ ...egg, grams_per_unit: null }, 2, 'unidad').kcal,
    ).toBe(0)
  })

  it('Comemos fuera aporta cero a todos los cálculos domésticos', () => {
    const outside = makePlanEntry({
      entry_kind: 'eating_out',
      meal_id: null,
      meal: null,
      planned_servings: null,
      portion: null,
    })
    expect(computePlanEntryDetailsTotals(outside)).toEqual({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      cost: 0,
    })
  })
})