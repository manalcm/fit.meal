import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlanEntryComposer } from './PlanEntryComposer'
import { makeIngredient } from '../test/fixtures'
import type { MealWithLines } from '../lib/meals'
import type { Person } from '../types/database'

const ingredient = makeIngredient({
  id: 'yogur',
  name: 'Yogur natural',
  default_unit: 'unidad',
  grams_per_unit: 125,
})
const meal: MealWithLines = {
  id: 'tostada',
  household_id: 'household-1',
  name: 'Tostada completa',
  meal_types: ['desayuno'],
  photo_url: null,
  notes: null,
  recipe_servings: 2,
  created_at: '2026-07-22T00:00:00Z',
  lines: [{ ingredient, quantity_grams: 250 }],
}
const people: Person[] = [
  {
    id: 'person-1',
    household_id: 'household-1',
    name: 'Manal',
    color: '#000000',
    target_kcal: 2000,
    target_protein: 100,
    target_carbs: 200,
    target_fat: 70,
    target_water_ml: 2000,
    show_water_tracking: true,
    created_at: '2026-07-22T00:00:00Z',
  },
  {
    id: 'person-2',
    household_id: 'household-1',
    name: 'Pareja',
    color: '#ffffff',
    target_kcal: 2500,
    target_protein: 120,
    target_carbs: 250,
    target_fat: 80,
    target_water_ml: 2000,
    show_water_tracking: true,
    created_at: '2026-07-22T00:00:00Z',
  },
]

function renderComposer(onAdd = vi.fn(), onEatingOut = vi.fn()) {
  render(
    <PlanEntryComposer
      mealType="desayuno"
      meals={[meal]}
      ingredients={[ingredient]}
      people={people}
      currentPersonId="person-1"
      onAdd={onAdd}
      onEatingOut={onEatingOut}
    />,
  )
}

describe('compositor de planificación', () => {
  it('activa por defecto la copia al resto y conserva la ración elegida', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    renderComposer(onAdd)
    fireEvent.click(screen.getByRole('button', { name: /añadir desayuno/i }))
    expect(screen.getByRole('checkbox')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Tostada completa' }))
    fireEvent.click(screen.getByRole('button', { name: '1.5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    expect(onAdd).toHaveBeenCalledWith({
      kind: 'meal',
      meal,
      servings: 1.5,
      copyToHousehold: true,
    })
  })

  it('registra un alimento suelto con su unidad configurada y cantidad exacta', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    renderComposer(onAdd)
    fireEvent.click(screen.getByRole('button', { name: /añadir desayuno/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Alimento suelto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yogur natural' }))
    expect(screen.getByText(/cantidad exacta \(unidades\)/i)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    expect(onAdd).toHaveBeenCalledWith({
      kind: 'loose_ingredient',
      ingredient,
      quantity: 1.5,
      copyToHousehold: true,
    })
  })

  it('permite elegir personas concretas para Comemos fuera', async () => {
    const onEatingOut = vi.fn().mockResolvedValue(undefined)
    renderComposer(vi.fn(), onEatingOut)
    fireEvent.click(screen.getByRole('button', { name: /añadir desayuno/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Comemos fuera' }))
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByRole('button', { name: 'Marcar' }))
    expect(onEatingOut).toHaveBeenCalledWith(['person-1', 'person-2'])
  })
})
