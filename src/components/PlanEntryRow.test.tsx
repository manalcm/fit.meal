import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlanEntryRow } from './PlanEntryRow'
import { makeIngredient, makePlanEntry } from '../test/fixtures'

describe('selector de raciones de una planificación', () => {
  it('no modifica nada al renderizar y elimina la opción de gramos exactos', () => {
    const onChangeServings = vi.fn()
    render(
      <PlanEntryRow
        entry={makePlanEntry()}
        onChangeServings={onChangeServings}
        onRemove={vi.fn()}
      />,
    )

    expect(onChangeServings).not.toHaveBeenCalled()
    expect(screen.queryByText(/gramos exactos/i)).not.toBeInTheDocument()
    expect(screen.getByText('300 kcal')).toBeInTheDocument()
  })

  it('permite elegir 1,5 y 2 raciones', () => {
    const onChangeServings = vi.fn()
    render(
      <PlanEntryRow
        entry={makePlanEntry()}
        onChangeServings={onChangeServings}
        onRemove={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '1.5' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(onChangeServings).toHaveBeenNthCalledWith(1, 1.5)
    expect(onChangeServings).toHaveBeenNthCalledWith(2, 2)
  })

  it('nunca baja de 0,5 raciones', () => {
    const onChangeServings = vi.fn()
    render(
      <PlanEntryRow
        entry={makePlanEntry({ planned_servings: 0.5, portion: 0.5 })}
        onChangeServings={onChangeServings}
        onRemove={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /disminuir/i }))
    expect(onChangeServings).toHaveBeenCalledWith(0.5)
  })

  it('muestra los gramos no convertibles como legado de solo lectura', () => {
    const onReplaceLegacy = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <PlanEntryRow
        entry={makePlanEntry({ planned_servings: null, portion: null, override_grams: 37 })}
        onChangeServings={vi.fn()}
        onRemove={vi.fn()}
        onReplaceLegacy={onReplaceLegacy}
      />,
    )

    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument()
    expect(screen.getByText(/37 g originales/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /sustituir manualmente/i }))
    expect(onReplaceLegacy).toHaveBeenCalledOnce()
  })
  it('no cambia un alimento suelto hasta pulsar Guardar y conserva decimales', () => {
    const ingredient = makeIngredient({
      name: 'Yogur',
      default_unit: 'unidad',
      grams_per_unit: 125,
    })
    const onChangeExactQuantity = vi.fn()
    render(
      <PlanEntryRow
        entry={makePlanEntry({
          entry_kind: 'loose_ingredient',
          meal_id: null,
          meal: null,
          ingredient_id: ingredient.id,
          ingredient,
          exact_quantity: 1,
          exact_unit: 'unidad',
          planned_servings: null,
          portion: null,
        })}
        onChangeServings={vi.fn()}
        onChangeExactQuantity={onChangeExactQuantity}
        onRemove={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1.5' } })
    expect(onChangeExactQuantity).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onChangeExactQuantity).toHaveBeenCalledWith(1.5)
  })

  it('muestra Comemos fuera sin kcal ni selector de cantidades', () => {
    render(
      <PlanEntryRow
        entry={makePlanEntry({
          entry_kind: 'eating_out',
          meal_id: null,
          meal: null,
          planned_servings: null,
          portion: null,
        })}
        onChangeServings={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    expect(screen.getByText('Comemos fuera')).toBeInTheDocument()
    expect(screen.queryByText(/kcal/)).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})
