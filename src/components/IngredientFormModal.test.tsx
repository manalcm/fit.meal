import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IngredientFormModal } from './IngredientFormModal'
import { makeIngredient } from '../test/fixtures'

describe('IngredientFormModal', () => {
  it('bloquea el fondo y cancelar no guarda cambios', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<IngredientFormModal initial={makeIngredient({ name: 'Arroz' })} onSave={onSave} onClose={onClose} />)

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Arroz cambiado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('muestra dentro de la edición el plato que bloquea el borrado', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('No se puede eliminar porque se utiliza en: Paella.'))
    render(
      <IngredientFormModal
        initial={makeIngredient({ name: 'Arroz' })}
        onSave={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar ingrediente' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Paella'))
  })
  it('no inventa un envase de 1 kg a partir del precio antiguo y conserva ese precio', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <IngredientFormModal
        initial={makeIngredient({
          price_per_kg: 12,
          package_price: null,
          package_size: null,
          package_unit: null,
        })}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Precio (€)')).toHaveValue('')
    expect(screen.getByLabelText('Cantidad (g)')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      price_per_kg: 12,
      package_price: null,
      package_size: null,
      package_unit: null,
    })
  })
})
