import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SurprisePlanner } from './SurprisePlanner'
import { makeIngredient, makePerson, makePlanEntry } from '../test/fixtures'
import type { MealWithLines } from '../lib/meals'

const mocks = vi.hoisted(() => ({
  listHouseholdPlanEntries: vi.fn(),
  addSurprisePlanItems: vi.fn(),
}))

vi.mock('../lib/planEntries', () => mocks)

const ingredient = makeIngredient({
  kcal_per_100g: 400,
  protein_per_100g: 20,
  carbs_per_100g: 30,
  fat_per_100g: 10,
  in_pantry: false,
})
const snack: MealWithLines = {
  id: 'snack-1',
  household_id: 'household-1',
  name: 'Merienda válida',
  meal_types: ['snack'],
  photo_url: null,
  notes: null,
  recipe_servings: 1,
  created_at: '2026-07-22T00:00:00Z',
  lines: [{ ingredient, quantity_grams: 100 }],
}
const people = [
  makePerson({
    id: 'person-1',
    name: 'Manal',
    target_kcal: 500,
    target_protein: 25,
    target_carbs: 35,
    target_fat: 12,
  }),
  makePerson({
    id: 'person-2',
    name: 'Pareja',
    target_kcal: 250,
    target_protein: 12,
    target_carbs: 20,
    target_fat: 6,
  }),
]

function renderPlanner(
  configuredPeople = people,
  onAdded = vi.fn().mockResolvedValue(undefined),
  onManual = vi.fn(),
) {
  render(
    <SurprisePlanner
      date="2026-07-22"
      meals={[snack]}
      people={configuredPeople}
      currentPersonId="person-1"
      onAdded={onAdded}
      onManual={onManual}
    />,
  )
  return { onAdded, onManual }
}

describe('flujo Sorpréndeme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listHouseholdPlanEntries.mockResolvedValue([])
  })

  it('solicita franja, usa Merienda y propone cantidades distintas por persona', async () => {
    renderPlanner()
    fireEvent.click(screen.getByRole('button', { name: '🎲 Sorpréndeme' }))
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Merienda' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Snack' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Merienda' }))
    expect(await screen.findByText('Merienda válida')).toBeInTheDocument()
    expect(screen.getByText('1 ración')).toBeInTheDocument()
    expect(screen.getByText('0.5 raciones')).toBeInTheDocument()
  })

  it('guarda la propuesta exacta y no genera ninguna receta nueva', async () => {
    const result = {
      created: [
        { id: 'entry-1', person_id: 'person-1' },
        { id: 'entry-2', person_id: 'person-2' },
      ],
      skipped: [],
    }
    mocks.addSurprisePlanItems.mockResolvedValue(result)
    const { onAdded } = renderPlanner()
    fireEvent.click(screen.getByRole('button', { name: '🎲 Sorpréndeme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Merienda' }))
    await screen.findByText('Merienda válida')
    fireEvent.click(screen.getByRole('button', { name: 'Añadir propuesta' }))

    await waitFor(() =>
      expect(mocks.addSurprisePlanItems).toHaveBeenCalledWith(
        'snack-1',
        '2026-07-22',
        'snack',
        [
          { personId: 'person-1', servings: 1 },
          { personId: 'person-2', servings: 0.5 },
        ],
      ),
    )
    expect(onAdded).toHaveBeenCalledWith(result)
  })

  it('respeta una franja ocupada y no la incluye en la propuesta', async () => {
    mocks.listHouseholdPlanEntries.mockResolvedValue([
      makePlanEntry({ person_id: 'person-2', meal_type: 'snack' }),
    ])
    renderPlanner()
    fireEvent.click(screen.getByRole('button', { name: '🎲 Sorpréndeme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Merienda' }))
    await screen.findByText('Merienda válida')
    expect(screen.getByText(/No se añadirá a Pareja/)).toBeInTheDocument()
    expect(screen.queryByText('0.5 raciones')).not.toBeInTheDocument()
  })

  it('si no hay opción válida ofrece únicamente volver o añadir manualmente', async () => {
    const restrictive = [
      makePerson({
        id: 'person-1',
        target_kcal: 1000,
        target_protein: 9,
        target_carbs: 100,
        target_fat: 100,
      }),
    ]
    const { onManual } = renderPlanner(restrictive)
    fireEvent.click(screen.getByRole('button', { name: '🎲 Sorpréndeme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Merienda' }))
    expect(
      await screen.findByText(
        'No hay platos que encajen en los macros restantes para esta franja.',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Volver',
      'Añadir manualmente',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Añadir manualmente' }))
    expect(onManual).toHaveBeenCalledWith('snack')
  })
})
