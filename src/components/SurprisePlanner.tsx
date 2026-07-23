import { useState } from 'react'
import type { MealType, Person } from '../types/database'
import type { MealWithLines } from '../lib/meals'
import {
  addSurprisePlanItems,
  listHouseholdPlanEntries,
  type SurprisePlanResult,
} from '../lib/planEntries'
import { chooseSurpriseCandidate, type SurpriseCandidate } from '../lib/randomPlan'
import { getErrorMessage } from '../lib/errors'

const SURPRISE_SLOTS: { value: MealType; label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'almuerzo', label: 'Comida' },
  { value: 'snack', label: 'Merienda' },
  { value: 'cena', label: 'Cena' },
]

interface Props {
  date: string
  meals: MealWithLines[]
  people: Person[]
  currentPersonId: string
  onAdded: (result: SurprisePlanResult) => Promise<void>
  onManual: (mealType: MealType) => void
}

type Stage = 'closed' | 'slot' | 'proposal' | 'empty'

export function SurprisePlanner({
  date,
  meals,
  people,
  currentPersonId,
  onAdded,
  onManual,
}: Props) {
  const [stage, setStage] = useState<Stage>('closed')
  const [copyToHousehold, setCopyToHousehold] = useState(true)
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null)
  const [candidate, setCandidate] = useState<SurpriseCandidate | null>(null)
  const [occupiedNames, setOccupiedNames] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function close() {
    setStage('closed')
    setSelectedMealType(null)
    setCandidate(null)
    setOccupiedNames([])
    setCopyToHousehold(true)
    setError('')
  }

  async function search(mealType: MealType) {
    setBusy(true)
    setError('')
    setSelectedMealType(mealType)
    try {
      const dayEntries = await listHouseholdPlanEntries(date, date)
      const occupiedIds = new Set(
        dayEntries
          .filter((entry) => entry.meal_type === mealType)
          .map((entry) => entry.person_id),
      )
      const currentPersonHasPlan = occupiedIds.has(currentPersonId)
      const namesAlreadyOccupied = people
        .filter((person) => person.id !== currentPersonId && occupiedIds.has(person.id))
        .map((person) => person.name)
      setOccupiedNames(copyToHousehold ? namesAlreadyOccupied : [])

      if (currentPersonHasPlan) {
        setCandidate(null)
        setStage('empty')
        return
      }

      const targetPeople = copyToHousehold
        ? people.filter((person) => !occupiedIds.has(person.id))
        : people.filter((person) => person.id === currentPersonId)
      const proposal = chooseSurpriseCandidate(meals, mealType, targetPeople, dayEntries)
      setCandidate(proposal)
      setStage(proposal ? 'proposal' : 'empty')
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function addProposal() {
    if (!candidate || !selectedMealType) return
    setBusy(true)
    setError('')
    try {
      const result = await addSurprisePlanItems(
        candidate.meal.id,
        date,
        selectedMealType,
        candidate.assignments.map((assignment) => ({
          personId: assignment.personId,
          servings: assignment.servings,
        })),
      )
      await onAdded(result)
      close()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  function addManually() {
    if (!selectedMealType) return
    const mealType = selectedMealType
    close()
    onManual(mealType)
  }

  if (stage === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setStage('slot')}
        disabled={meals.length === 0}
        className="mt-2 w-full rounded-2xl bg-surface py-3 text-sm font-bold text-accent transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        🎲 Sorpréndeme
      </button>
    )
  }

  return (
    <section className="mt-2 rounded-[20px] bg-surface p-4" aria-label="Sorpréndeme">
      {stage === 'slot' && (
        <>
          <p className="font-serif text-lg font-semibold text-ink italic">¿Para qué comida?</p>
          <p className="mt-1 text-xs text-muted">
            Buscaré un plato de tu biblioteca que no supere los macros restantes.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {SURPRISE_SLOTS.map((slot) => (
              <button
                type="button"
                key={slot.value}
                onClick={() => search(slot.value)}
                disabled={busy}
                className="rounded-xl bg-bg py-2.5 text-sm font-bold text-ink disabled:opacity-50"
              >
                {slot.label}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-xs font-bold text-ink">
            <input
              type="checkbox"
              checked={copyToHousehold}
              onChange={(event) => setCopyToHousehold(event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Añadir también al resto de la casa
          </label>
          {error && <p className="mt-2 text-xs text-over">{error}</p>}
          <button
            type="button"
            onClick={close}
            className="mt-3 w-full rounded-xl border border-track py-2 text-xs font-bold text-muted"
          >
            Cancelar
          </button>
        </>
      )}

      {stage === 'proposal' && candidate && (
        <>
          <p className="text-xs font-bold tracking-wide text-accent uppercase">Propuesta</p>
          <p className="mt-1 font-serif text-xl font-semibold text-ink italic">
            {candidate.meal.name}
          </p>
          <div className="mt-3 space-y-1.5">
            {candidate.assignments.map((assignment) => (
              <div
                key={assignment.personId}
                className="flex items-center justify-between rounded-xl bg-bg px-3 py-2 text-sm"
              >
                <span className="text-ink">{assignment.personName}</span>
                <span className="font-bold text-accent">
                  {assignment.servings} {assignment.servings === 1 ? 'ración' : 'raciones'}
                </span>
              </div>
            ))}
          </div>
          {occupiedNames.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              No se añadirá a {occupiedNames.join(', ')} porque esa franja ya está ocupada.
            </p>
          )}
          {error && <p className="mt-2 text-xs text-over">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setStage('slot')}
              disabled={busy}
              className="flex-1 rounded-xl border border-track py-2 text-xs font-bold text-muted"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={addProposal}
              disabled={busy}
              className="flex-1 rounded-xl bg-ink py-2 text-xs font-bold text-cream disabled:opacity-50"
            >
              {busy ? 'Añadiendo…' : 'Añadir propuesta'}
            </button>
          </div>
        </>
      )}

      {stage === 'empty' && (
        <>
          <p className="text-sm font-bold text-ink">
            No hay platos que encajen en los macros restantes para esta franja.
          </p>
          {error && <p className="mt-2 text-xs text-over">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setStage('slot')}
              className="flex-1 rounded-xl border border-track py-2 text-xs font-bold text-muted"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={addManually}
              className="flex-1 rounded-xl bg-ink py-2 text-xs font-bold text-cream"
            >
              Añadir manualmente
            </button>
          </div>
        </>
      )}
    </section>
  )
}
