import { describe, expect, it } from 'vitest'
import { formatHouseholdPlanResultMessage } from './useHouseholdPlanActions'

describe('mensajes de copia familiar', () => {
  it('explica las copias creadas y cada franja que se ha respetado', () => {
    expect(
      formatHouseholdPlanResultMessage(1, [{ name: 'Lucía' }, { name: 'Álex' }]),
    ).toBe(
      'Añadido también a 1 persona. No se ha añadido a Lucía porque esa franja ya tiene una planificación. No se ha añadido a Álex porque esa franja ya tiene una planificación.',
    )
  })
})
