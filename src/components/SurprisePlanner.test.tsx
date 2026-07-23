import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SurprisePlanner } from './SurprisePlanner'
import { makeIngredient, makePerson } from '../test/fixtures'
import type { MealWithLines } from '../lib/meals'

const mocks = vi.hoisted(() => ({ listHouseholdPlanEntries: vi.fn(), addSurprisePlanItems: vi.fn() }))
vi.mock('../lib/planEntries', () => mocks)

const breakfast: MealWithLines = {
  id: 'breakfast', household_id: 'household-1', name: 'Desayuno', meal_types: ['desayuno'],
  photo_url: null, notes: null, recipe_servings: 1, created_at: '2026-07-22T00:00:00Z',
  lines: [{ ingredient: makeIngredient({ kcal_per_100g: 200 }), quantity_grams: 100 }],
}

describe('Sorpréndeme el día', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.listHouseholdPlanEntries.mockResolvedValue([]) })

  it('prepara una propuesta completa y solo guarda tras confirmarla', async () => {
    mocks.addSurprisePlanItems.mockResolvedValue({ created: [{ id: 'entry', person_id: 'person-1' }], skipped: [] })
    const onAdded = vi.fn().mockResolvedValue(undefined)
    render(<SurprisePlanner date="2026-07-22" meals={[breakfast]} people={[makePerson()]} currentPersonId="person-1" onAdded={onAdded} />)
    fireEvent.click(screen.getByRole('button', { name: '🎲 Sorpréndeme el día' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver propuesta' }))
    expect(await screen.findByText('Tu día propuesto')).toBeInTheDocument()
    expect(mocks.addSurprisePlanItems).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir el día' }))
    await waitFor(() => expect(mocks.addSurprisePlanItems).toHaveBeenCalledWith('breakfast', '2026-07-22', 'desayuno', [{ personId: 'person-1', servings: 1 }]))
  })
})
