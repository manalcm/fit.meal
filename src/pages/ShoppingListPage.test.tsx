import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShoppingListPage } from './ShoppingListPage'
import { calculateShoppingItem } from '../lib/shoppingList'
import { makeIngredient } from '../test/fixtures'

const mocks = vi.hoisted(() => ({
  buildShoppingList: vi.fn(),
  weeklyBudget: 3 as number | null,
}))

vi.mock('../lib/shoppingList', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/shoppingList')>()
  return { ...actual, buildShoppingList: mocks.buildShoppingList }
})

vi.mock('../lib/HouseholdContext', () => ({
  useHousehold: () => ({
    activeHousehold: {
      id: 'household-1',
      weekly_budget: mocks.weeklyBudget,
    },
  }),
}))

describe('presentación de la estimación semanal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.weeklyBudget = 3
  })

  it('muestra envases completos, necesidad, compra y ambos costes', async () => {
    const milk = makeIngredient({
      id: 'milk',
      name: 'Leche',
      category: 'lacteo',
      default_unit: 'ml',
      package_unit: 'ml',
      package_size: 1000,
      package_price: 1,
    })
    mocks.buildShoppingList.mockResolvedValue([calculateShoppingItem(milk, 'ml', 1100)])
    render(
      <MemoryRouter>
        <ShoppingListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Leche — 2 envases de 1 L')).toBeInTheDocument()
    expect(screen.getByText('Necesitas 1,1 L · Comprarías 2 L')).toBeInTheDocument()
    expect(screen.getByText('Consumo: 1,10 € · Compra: 2,00 €')).toBeInTheDocument()
    expect(screen.getByText('Te quedan 1,00 €.')).toBeInTheDocument()
  })

  it('explica los datos ausentes y no presenta el presupuesto parcial como definitivo', async () => {
    const item = calculateShoppingItem(
      makeIngredient({
        id: 'rice',
        name: 'Arroz',
        package_price: null,
        package_size: null,
        package_unit: null,
      }),
      'gramos',
      300,
    )
    mocks.buildShoppingList.mockResolvedValue([item])
    render(
      <MemoryRouter>
        <ShoppingListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Falta configurar el tamaño del envase')).toBeInTheDocument()
    expect(screen.getByText('Falta configurar el precio')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Configurar ingrediente' })).toHaveAttribute(
      'href',
      '/ingredientes?editar=rice',
    )
    expect(
      screen.getByText('Presupuesto parcial: faltan datos de 1 ingrediente.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Te quedan/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Superas el presupuesto/)).not.toBeInTheDocument()
  })
})
