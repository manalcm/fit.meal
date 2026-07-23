import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IngredientsPage } from './IngredientsPage'
import { makeIngredient } from '../test/fixtures'

const ingredientMocks = vi.hoisted(() => ({
  listIngredients: vi.fn(),
  createIngredient: vi.fn(),
  updateIngredient: vi.fn(),
  deleteIngredient: vi.fn(),
  deleteUnusedIngredients: vi.fn(),
}))

vi.mock('../lib/ingredients', () => ingredientMocks)
vi.mock('../lib/HouseholdContext', () => ({
  useHousehold: () => ({ activeHousehold: { id: 'household-1' } }),
}))

const ingredients = [
  makeIngredient({ id: 'rice', name: 'Arroz' }),
  makeIngredient({ id: 'milk', name: 'Leche' }),
  makeIngredient({ id: 'egg', name: 'Huevos' }),
]

function renderPage() {
  return render(
    <MemoryRouter>
      <IngredientsPage />
    </MemoryRouter>,
  )
}

describe('IngredientsPage', () => {
  beforeEach(() => {
    ingredientMocks.listIngredients.mockResolvedValue(ingredients)
    ingredientMocks.deleteUnusedIngredients.mockResolvedValue({ deleted_ids: [], blocked: [] })
    vi.restoreAllMocks()
  })

  it('quita el borrado de las tarjetas y coloca + Añadir junto al buscador', async () => {
    const { container } = renderPage()
    await screen.findByText('Arroz')

    expect(screen.getByRole('button', { name: '+ Añadir' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
    expect(container.querySelector('button.fixed')).toBeNull()

    fireEvent.click(screen.getByText('Arroz'))
    expect(screen.getByRole('button', { name: 'Eliminar ingrediente' })).toBeInTheDocument()
  })

  it('selecciona únicamente los resultados de la búsqueda', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    ingredientMocks.deleteUnusedIngredients.mockResolvedValue({ deleted_ids: ['milk'], blocked: [] })
    renderPage()
    await screen.findByText('Arroz')

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }))
    fireEvent.change(screen.getByPlaceholderText('Buscar ingrediente…'), { target: { value: 'lech' } })
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todos los resultados' }))

    expect(screen.getByText('1 seleccionados')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar seleccionados' }))
    await waitFor(() => expect(ingredientMocks.deleteUnusedIngredients).toHaveBeenCalledWith(['milk']))
    expect(await screen.findByText(/Se eliminó 1 ingrediente/)).toBeInTheDocument()
  })

  it('elimina solo los no usados e informa de los platos que bloquean el resto', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    ingredientMocks.deleteUnusedIngredients.mockResolvedValue({
      deleted_ids: ['milk', 'egg'],
      blocked: [{ ingredient_id: 'rice', meal_names: ['Paella', 'Arroz con pollo'] }],
    })
    renderPage()
    await screen.findByText('Arroz')

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todos los resultados' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar seleccionados' }))

    expect(await screen.findByText(/Se eliminaron 2 ingredientes/)).toBeInTheDocument()
    expect(screen.getByText(/Paella, Arroz con pollo/)).toBeInTheDocument()
    expect(screen.getByText('1 seleccionados')).toBeInTheDocument()
  })
})
