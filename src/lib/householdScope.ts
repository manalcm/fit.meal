let activeHouseholdId: string | null = null

export function setActiveHouseholdId(id: string | null) {
  activeHouseholdId = id
}

export function requireActiveHouseholdId(): string {
  if (!activeHouseholdId) {
    throw new Error('Selecciona o crea un hogar antes de continuar.')
  }
  return activeHouseholdId
}
