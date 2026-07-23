import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { WaterTracker } from './WaterTracker'
import { makePerson } from '../test/fixtures'

describe('WaterTracker', () => {
  beforeEach(() => localStorage.clear())

  it('se oculta sin borrar los registros y los recupera al reactivarse', () => {
    const date = '2026-07-22'
    const hiddenPerson = makePerson({ show_water_tracking: false })
    const key = `fitmeal:water:${hiddenPerson.id}:${date}`
    localStorage.setItem(key, '750')

    const { rerender } = render(<WaterTracker person={hiddenPerson} date={date} />)
    expect(screen.queryByText('Agua')).not.toBeInTheDocument()
    expect(localStorage.getItem(key)).toBe('750')

    rerender(<WaterTracker person={{ ...hiddenPerson, show_water_tracking: true }} date={date} />)
    expect(screen.getByText('750 / 2000 ml')).toBeInTheDocument()
    expect(localStorage.getItem(key)).toBe('750')
  })

  it('mantiene sus registros separados por persona', () => {
    const date = '2026-07-22'
    const first = makePerson({ id: 'person-1', show_water_tracking: true })
    const second = makePerson({ id: 'person-2', show_water_tracking: true })

    const { rerender } = render(<WaterTracker person={first} date={date} />)
    fireEvent.click(screen.getByRole('button', { name: '+ 250 ml' }))
    expect(localStorage.getItem(`fitmeal:water:${first.id}:${date}`)).toBe('250')

    rerender(<WaterTracker person={second} date={date} />)
    expect(screen.getByText('0 / 2000 ml')).toBeInTheDocument()
    expect(localStorage.getItem(`fitmeal:water:${second.id}:${date}`)).toBeNull()
  })
})
