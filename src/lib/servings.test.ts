import { describe, expect, it } from 'vitest'
import { applyServingPatch, buildServingPatch } from './servings'
import { makePlanEntry } from '../test/fixtures'

describe('actualización de raciones', () => {
  it('crea un cambio consistente para la base de datos', () => {
    expect(buildServingPatch(1.5)).toEqual({
      planned_servings: 1.5,
      portion: 1.5,
      override_grams: null,
    })
  })

  it.each([0, -0.5, 0.75])('rechaza la cantidad no válida %s', (value) => {
    expect(() => buildServingPatch(value)).toThrow(/raciones/i)
  })

  it('modifica solo la planificación seleccionada y no la de otra persona', () => {
    const first = makePlanEntry({ id: 'entry-1', person_id: 'person-1' })
    const second = makePlanEntry({ id: 'entry-2', person_id: 'person-2' })
    const updated = applyServingPatch([first, second], first.id, buildServingPatch(2))

    expect(updated[0].planned_servings).toBe(2)
    expect(updated[1]).toBe(second)
    expect(updated[1].planned_servings).toBe(1)
  })
})
