import { describe, expect, it } from 'vitest'
import {
  aggregateRequirements,
  calculateShoppingItem,
  compareShoppingBudget,
  requirementsFromPlanEntries,
  splitPantry,
  summarizeShoppingList,
} from './shoppingList'
import { makeIngredient } from '../test/fixtures'

describe('cálculo de envases', () => {
  it('convierte 1.100 ml de leche en 2 envases de 1.000 ml', () => {
    const milk = makeIngredient({
      id: 'milk',
      name: 'Leche',
      default_unit: 'ml',
      package_unit: 'ml',
      package_size: 1000,
      package_price: 1,
    })
    const item = calculateShoppingItem(milk, 'ml', 1100)
    expect(item.packageCount).toBe(2)
    expect(item.purchasedQuantity).toBe(2000)
    expect(item.purchaseCost).toBe(2)
    expect(item.consumedCost).toBeCloseTo(1.1)
  })

  it('convierte 14 huevos en 2 envases de 12 sin mostrar envases fraccionados', () => {
    const eggs = makeIngredient({
      id: 'eggs',
      name: 'Huevos',
      default_unit: 'unidad',
      package_unit: 'unidad',
      package_size: 12,
      package_price: 2.4,
      grams_per_unit: 60,
    })
    const item = calculateShoppingItem(eggs, 'unidad', 14)
    expect(item.packageCount).toBe(2)
    expect(item.purchasedQuantity).toBe(24)
    expect(item.purchaseCost).toBeCloseTo(4.8)
    expect(item.consumedCost).toBeCloseTo(2.8)
  })

  it('suma varias personas y días cuando ingrediente y unidad coinciden', () => {
    const rice = makeIngredient({
      id: 'rice',
      package_unit: 'gramos',
      package_size: 500,
      package_price: 1.5,
    })
    const [item] = aggregateRequirements([
      { ingredient: rice, quantity: 120, unit: 'gramos' },
      { ingredient: rice, quantity: 180, unit: 'gramos' },
      { ingredient: rice, quantity: 250, unit: 'gramos' },
    ])
    expect(item.neededQuantity).toBe(550)
    expect(item.packageCount).toBe(2)
  })

  it('no mezcla ni convierte gramos, mililitros y unidades', () => {
    const ingredient = makeIngredient({
      id: 'mixed',
      package_unit: 'ml',
      package_size: 1000,
      package_price: 1,
    })
    const items = aggregateRequirements([
      { ingredient, quantity: 100, unit: 'gramos' },
      { ingredient, quantity: 100, unit: 'ml' },
    ])
    expect(items).toHaveLength(2)
    expect(items.find((item) => item.unit === 'gramos')?.incompatiblePackageUnit).toBe(true)
    expect(items.find((item) => item.unit === 'gramos')?.packageCount).toBeNull()
    expect(items.find((item) => item.unit === 'ml')?.packageCount).toBe(1)
  })

  it('excluye de la compra lo que está disponible en despensa', () => {
    const available = calculateShoppingItem(
      makeIngredient({ id: 'pantry', in_pantry: true }),
      'gramos',
      100,
    )
    const missing = calculateShoppingItem(
      makeIngredient({ id: 'buy', in_pantry: false }),
      'gramos',
      100,
    )
    expect(splitPantry([available, missing])).toEqual({
      toBuy: [missing],
      inPantry: [available],
    })
  })

  it('incluye alimentos sueltos, aplica raciones de platos y excluye Comemos fuera', () => {
    const milk = makeIngredient({ id: 'milk', default_unit: 'ml' })
    const rice = makeIngredient({ id: 'rice' })
    const requirements = requirementsFromPlanEntries([
      {
        entry_kind: 'loose_ingredient',
        exact_quantity: 1100,
        exact_unit: 'ml',
        planned_servings: null,
        portion: null,
        override_grams: null,
        legacy_snapshot: null,
        ingredient: milk,
        meal: null,
      },
      {
        entry_kind: 'meal',
        exact_quantity: null,
        exact_unit: null,
        planned_servings: 2,
        portion: 2,
        override_grams: null,
        legacy_snapshot: null,
        ingredient: null,
        meal: {
          recipe_servings: 4,
          meal_ingredients: [{ ingredient: rice, quantity_grams: 100 }],
        },
      },
      {
        entry_kind: 'eating_out',
        exact_quantity: null,
        exact_unit: null,
        planned_servings: null,
        portion: null,
        override_grams: null,
        legacy_snapshot: null,
        ingredient: null,
        meal: null,
      },
    ])
    expect(requirements).toEqual([
      { ingredient: milk, quantity: 1100, unit: 'ml' },
      { ingredient: rice, quantity: 50, unit: 'gramos' },
    ])
  })
  it('distingue datos completos y parciales sin ocultar cuántos faltan', () => {
    const complete = calculateShoppingItem(
      makeIngredient({
        id: 'complete',
        package_unit: 'gramos',
        package_size: 500,
        package_price: 2,
      }),
      'gramos',
      100,
    )
    const incomplete = calculateShoppingItem(
      makeIngredient({ id: 'incomplete', package_unit: null }),
      'gramos',
      100,
    )
    expect(summarizeShoppingList([complete, incomplete])).toMatchObject({
      isComplete: false,
      missingPriceCount: 1,
      missingPackageSizeCount: 1,
      incompleteIngredientCount: 1,
    })
  })
})

describe('presupuesto semanal', () => {
  const completeSummary = {
    consumedTotal: 20,
    purchaseTotal: 81.6,
    missingPriceCount: 0,
    missingPackageSizeCount: 0,
    incompleteIngredientCount: 0,
    isComplete: true,
  }

  it('no muestra comparación cuando no hay presupuesto', () => {
    expect(compareShoppingBudget(null, completeSummary)).toBeNull()
  })

  it('calcula el dinero restante contra envases completos', () => {
    expect(compareShoppingBudget(100, completeSummary)).toMatchObject({
      purchaseTotal: 81.6,
      remaining: 18.4,
      excess: 0,
      isPartial: false,
    })
  })

  it('calcula el exceso e identifica presupuestos parciales', () => {
    expect(compareShoppingBudget(74.4, completeSummary)).toMatchObject({
      remaining: 0,
      excess: 7.2,
    })
    expect(
      compareShoppingBudget(100, {
        ...completeSummary,
        isComplete: false,
        incompleteIngredientCount: 3,
      }),
    ).toMatchObject({ isPartial: true, incompleteIngredientCount: 3 })
  })
})
