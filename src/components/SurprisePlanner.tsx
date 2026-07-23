import { useState } from 'react'
import type { Person } from '../types/database'
import type { MealWithLines } from '../lib/meals'
import {
  addSurprisePlanItems,
  listHouseholdPlanEntries,
  type SurprisePlanResult,
} from '../lib/planEntries'
import {
  chooseSurpriseDay,
  type SurpriseDaySlot,
} from '../lib/randomPlan'
import { MEAL_TYPE_LABELS } from '../data/mealTypes'
import { getErrorMessage } from '../lib/errors'

interface Props {
  date: string
  meals: MealWithLines[]
  people: Person[]
  currentPersonId: string
  onAdded: (result: SurprisePlanResult) => Promise<void>
}

type Stage = 'closed' | 'setup' | 'preview'

export function SurprisePlanner({ date, meals, people, currentPersonId, onAdded }: Props) {
  const [stage, setStage] = useState<Stage>('closed')
  const [copyToHousehold, setCopyToHousehold] = useState(true)
  const [slots, setSlots] = useState<SurpriseDaySlot[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function close() {
    setStage('closed')
    setCopyToHousehold(true)
    setSlots([])
    setError('')
  }

  async function prepareDay() {
    setBusy(true)
    setError('')
    try {
      const entries = await listHouseholdPlanEntries(date, date)
      setSlots(chooseSurpriseDay(meals, people, currentPersonId, copyToHousehold, entries))
      setStage('preview')
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function addDay() {
    setBusy(true)
    setError('')
    try {
      const combined: SurprisePlanResult = { created: [], skipped: [] }
      for (const slot of slots) {
        if (!slot.candidate) continue
        const result = await addSurprisePlanItems(
          slot.candidate.meal.id,
          date,
          slot.mealType,
          slot.candidate.assignments.map(({ personId, servings }) => ({ personId, servings })),
        )
        combined.created.push(...result.created)
        combined.skipped.push(...result.skipped)
      }
      await onAdded(combined)
      close()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setStage('setup')}
        disabled={meals.length === 0}
        className="mt-2 w-full rounded-2xl bg-surface py-3 text-sm font-bold text-accent transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        🎲 Sorpréndeme el día
      </button>
    )
  }

  return (
    <section className="mt-2 rounded-[20px] bg-surface p-4" aria-label="Sorpréndeme el día">
      {stage === 'setup' && (
        <>
          <p className="font-serif text-lg font-semibold text-ink italic">¿Te preparo el día?</p>
          <p className="mt-1 text-xs text-muted">
            Buscaré desayuno, comida, merienda y cena sin superar los macros restantes.
          </p>
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
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={close} className="flex-1 rounded-xl border border-track py-2 text-xs font-bold text-muted">Cancelar</button>
            <button type="button" onClick={prepareDay} disabled={busy} className="flex-1 rounded-xl bg-ink py-2 text-xs font-bold text-cream disabled:opacity-50">
              {busy ? 'Preparando…' : 'Ver propuesta'}
            </button>
          </div>
        </>
      )}

      {stage === 'preview' && (
        <>
          <p className="font-serif text-lg font-semibold text-ink italic">Tu día propuesto</p>
          <div className="mt-3 space-y-2">
            {slots.map((slot) => (
              <div key={slot.mealType} className="rounded-xl bg-bg px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-accent">{MEAL_TYPE_LABELS[slot.mealType]}</p>
                {slot.candidate ? (
                  <>
                    <p className="text-sm font-bold text-ink">{slot.candidate.meal.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {slot.candidate.assignments.map((a) => `${a.personName}: ${a.servings} ${a.servings === 1 ? 'ración' : 'raciones'}`).join(' · ')}
                    </p>
                  </>
                ) : slot.occupiedPersonNames.length > 0 ? (
                  <p className="text-xs text-muted">Ya planificado para {slot.occupiedPersonNames.join(', ')}.</p>
                ) : (
                  <p className="text-xs text-muted">No hay un plato que encaje en los macros restantes.</p>
                )}
              </div>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-over">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setStage('setup')} disabled={busy} className="flex-1 rounded-xl border border-track py-2 text-xs font-bold text-muted">Volver</button>
            <button type="button" onClick={addDay} disabled={busy || !slots.some((slot) => slot.candidate)} className="flex-1 rounded-xl bg-ink py-2 text-xs font-bold text-cream disabled:opacity-50">
              {busy ? 'Añadiendo…' : 'Añadir el día'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
