import { isHalfServingStep } from './calculations'

export interface ServingPatch {
  planned_servings: number
  portion: number
  override_grams: null
}

export function buildServingPatch(servings: number): ServingPatch {
  if (!isHalfServingStep(servings)) {
    throw new Error('Las raciones deben ser 0,5 o un múltiplo positivo de 0,5.')
  }
  return { planned_servings: servings, portion: servings, override_grams: null }
}

export function applyServingPatch<T extends { id: string }>(
  entries: T[],
  entryId: string,
  patch: ServingPatch,
): T[] {
  return entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry))
}
