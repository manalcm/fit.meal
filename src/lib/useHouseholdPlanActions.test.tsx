import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHouseholdPlanActions } from './useHouseholdPlanActions'
import { makeIngredient } from '../test/fixtures'

const mocks = vi.hoisted(() => ({
  createHouseholdPlanItem: vi.fn(),
  deletePlanEntries: vi.fn(),
  listOccupiedPersonIds: vi.fn(),
  setEatingOutForPeople: vi.fn(),
}))

vi.mock('./planEntries', () => mocks)

describe('acciones familiares de planificación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('deshace únicamente las copias recién creadas y conserva el original', async () => {
    mocks.createHouseholdPlanItem.mockResolvedValue({
      source_id: 'original',
      copy_ids: ['copy-1', 'copy-2'],
      copied_person_ids: ['person-2', 'person-3'],
      skipped: [],
    })
    mocks.deletePlanEntries.mockResolvedValue(undefined)
    const onChanged = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useHouseholdPlanActions({ sourcePersonId: 'person-1', onChanged }),
    )

    await act(() =>
      result.current.addItem('2026-07-22', 'desayuno', {
        kind: 'loose_ingredient',
        ingredient: makeIngredient(),
        quantity: 125.5,
        copyToHousehold: true,
      }),
    )
    expect(result.current.notice?.copyIds).toEqual(['copy-1', 'copy-2'])

    await act(() => result.current.undoCopies())
    expect(mocks.deletePlanEntries).toHaveBeenCalledWith(['copy-1', 'copy-2'])
    expect(mocks.deletePlanEntries).not.toHaveBeenCalledWith(expect.arrayContaining(['original']))
  })

  it('no sustituye una franja ocupada si se cancela la confirmación', async () => {
    mocks.listOccupiedPersonIds.mockResolvedValue(['person-1'])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = renderHook(() =>
      useHouseholdPlanActions({ sourcePersonId: 'person-1', onChanged: vi.fn() }),
    )

    await act(() => result.current.markEatingOut('2026-07-22', 'almuerzo', ['person-1']))
    expect(mocks.setEatingOutForPeople).not.toHaveBeenCalled()
  })

  it('sustituye solo tras confirmar y comunica la intención a la operación atómica', async () => {
    mocks.listOccupiedPersonIds.mockResolvedValue(['person-1'])
    mocks.setEatingOutForPeople.mockResolvedValue({ created_ids: ['outside-1'] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onChanged = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useHouseholdPlanActions({ sourcePersonId: 'person-1', onChanged }),
    )

    await act(() => result.current.markEatingOut('2026-07-22', 'almuerzo', ['person-1']))
    expect(mocks.setEatingOutForPeople).toHaveBeenCalledWith(
      ['person-1'],
      '2026-07-22',
      'almuerzo',
      true,
    )
  })
})
