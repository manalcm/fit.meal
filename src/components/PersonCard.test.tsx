import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PersonCard } from './PersonCard'
import { makePerson } from '../test/fixtures'

const peopleMocks = vi.hoisted(() => ({
  updatePerson: vi.fn(),
  deletePerson: vi.fn(),
}))

vi.mock('../lib/people', () => peopleMocks)

describe('PersonCard', () => {
  it('guarda la visibilidad del agua de forma independiente sin borrar su objetivo', async () => {
    const person = makePerson({ target_water_ml: 2300, show_water_tracking: true })
    peopleMocks.updatePerson.mockImplementation(async (_id, input) => ({ ...person, ...input }))
    const onSaved = vi.fn()
    render(<PersonCard person={person} onSaved={onSaved} onDeleted={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Mostrar seguimiento de agua/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(peopleMocks.updatePerson).toHaveBeenCalled())
    expect(peopleMocks.updatePerson.mock.calls[0][1]).toMatchObject({
      target_water_ml: 2300,
      show_water_tracking: false,
    })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ show_water_tracking: false }))
  })

  it('no muestra el resumen de agua cuando está desactivado', () => {
    render(
      <PersonCard
        person={makePerson({ show_water_tracking: false })}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.queryByText('Agua')).not.toBeInTheDocument()
  })
})
