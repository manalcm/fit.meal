import { useEffect, useState } from 'react'
import type { MealType } from '../types/database'
import type { PlanComposerItem } from '../components/PlanEntryComposer'
import {
  createHouseholdPlanItem,
  deletePlanEntries,
  listOccupiedPersonIds,
  setEatingOutForPeople,
} from './planEntries'

export interface PlanActionNotice {
  message: string
  copyIds: string[]
}

interface Options {
  sourcePersonId: string
  onChanged: () => Promise<void> | void
}

export function formatHouseholdPlanResultMessage(
  copyCount: number,
  skipped: { name: string }[],
): string {
  const parts: string[] = []
  if (copyCount > 0) {
    parts.push(`Añadido también a ${copyCount} ${copyCount === 1 ? 'persona' : 'personas'}.`)
  }
  for (const person of skipped) {
    parts.push(
      `No se ha añadido a ${person.name} porque esa franja ya tiene una planificación.`,
    )
  }
  return parts.join(' ')
}

export function useHouseholdPlanActions({ sourcePersonId, onChanged }: Options) {
  const [notice, setNotice] = useState<PlanActionNotice | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [notice])

  function announceHouseholdCopies(
    copyIds: string[],
    skipped: { name: string }[],
  ) {
    const message = formatHouseholdPlanResultMessage(copyIds.length, skipped)
    setNotice(message ? { message, copyIds } : null)
  }

  async function addItem(date: string, mealType: MealType, item: PlanComposerItem) {
    const result = await createHouseholdPlanItem(
      item.kind === 'meal'
        ? {
            kind: 'meal',
            sourcePersonId,
            date,
            mealType,
            mealId: item.meal.id,
            plannedServings: item.servings,
            copyToHousehold: item.copyToHousehold,
          }
        : {
            kind: 'loose_ingredient',
            sourcePersonId,
            date,
            mealType,
            ingredientId: item.ingredient.id,
            exactQuantity: item.quantity,
            exactUnit: item.ingredient.default_unit,
            copyToHousehold: item.copyToHousehold,
          },
    )
    await onChanged()
    announceHouseholdCopies(result.copy_ids, result.skipped)
  }

  async function markEatingOut(date: string, mealType: MealType, personIds: string[]) {
    const occupied = await listOccupiedPersonIds(personIds, date, mealType)
    if (
      occupied.length > 0 &&
      !window.confirm(
        'Esta franja ya contiene una planificación. ¿Quieres sustituirla por “Comemos fuera”?',
      )
    ) {
      return
    }
    await setEatingOutForPeople(personIds, date, mealType, occupied.length > 0)
    await onChanged()
    setNotice({ message: 'Se ha marcado “Comemos fuera”.', copyIds: [] })
  }

  async function undoCopies() {
    if (!notice?.copyIds.length) return
    const copyIds = notice.copyIds
    setNotice(null)
    await deletePlanEntries(copyIds)
    await onChanged()
  }

  return { notice, addItem, markEatingOut, undoCopies, announceHouseholdCopies }
}
