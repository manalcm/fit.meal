import { useEffect, useMemo, useState } from 'react'
import { usePerson } from '../lib/PersonContext'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { PlanEntryComposer, type PlanComposerItem } from '../components/PlanEntryComposer'
import { PlanActionNotice } from '../components/PlanActionNotice'
import { PlanEntryRow } from '../components/PlanEntryRow'
import { MonthCalendar } from '../components/MonthCalendar'
import {
  listPlanEntries,
  updatePlanEntry,
  updateLoosePlanEntry,
  deletePlanEntry,
  copyDay,
  copyWeek,
  type PlanEntryWithDetails,
} from '../lib/planEntries'
import { applyServingPatch, buildServingPatch, type ServingPatch } from '../lib/servings'
import { listMeals, type MealWithLines } from '../lib/meals'
import { listIngredients } from '../lib/ingredients'
import { computePlanEntryDetailsTotals, sumTotals, round1 } from '../lib/calculations'
import { toISODate, addDays, startOfWeek, dayLabel, rangeLabel } from '../lib/dates'
import { MEAL_TYPES } from '../data/mealTypes'
import { getErrorMessage } from '../lib/errors'
import { useHouseholdPlanActions } from '../lib/useHouseholdPlanActions'
import type { Ingredient, MealType } from '../types/database'

function ChevronLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function WeekPage() {
  const { selected: person, people, loading: personLoading } = usePerson()
  const [view, setView] = useState<'semana' | 'mes'>('semana')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [entries, setEntries] = useState<PlanEntryWithDetails[]>([])
  const [meals, setMeals] = useState<MealWithLines[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedDate, setCopiedDate] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState(false)

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const weekStartISO = toISODate(weekStart)
  const weekEndISO = toISODate(days[6])

  async function reloadEntries() {
    if (!person) return
    setEntries(await listPlanEntries(person.id, weekStartISO, weekEndISO))
  }

  const householdActions = useHouseholdPlanActions({
    sourcePersonId: person?.id ?? '',
    onChanged: reloadEntries,
  })

  useEffect(() => {
    if (!person) return
    setLoading(true)
    Promise.all([
      listPlanEntries(person.id, weekStartISO, weekEndISO),
      listMeals(),
      listIngredients(),
    ])
      .then(([nextEntries, nextMeals, nextIngredients]) => {
        setEntries(nextEntries)
        setMeals(nextMeals)
        setIngredients(nextIngredients)
        setError('')
      })
      .catch((caught) => setError(getErrorMessage(caught)))
      .finally(() => setLoading(false))
  }, [person, weekStartISO, weekEndISO])

  async function handleAdd(dateISO: string, mealType: MealType, item: PlanComposerItem) {
    await householdActions.addItem(dateISO, mealType, item)
  }

  async function handleEatingOut(dateISO: string, mealType: MealType, personIds: string[]) {
    await householdActions.markEatingOut(dateISO, mealType, personIds)
  }

  async function handlePatch(entry: PlanEntryWithDetails, patch: ServingPatch) {
    setEntries((current) => applyServingPatch(current, entry.id, patch))
    try {
      await updatePlanEntry(entry.id, patch)
    } catch (caught) {
      setError(getErrorMessage(caught))
      await reloadEntries()
    }
  }

  async function handleExactQuantity(entry: PlanEntryWithDetails, quantity: number) {
    try {
      await updateLoosePlanEntry(entry.id, quantity)
      await reloadEntries()
    } catch (caught) {
      setError(getErrorMessage(caught))
    }
  }

  async function handleRemove(entry: PlanEntryWithDetails) {
    setEntries((current) => current.filter((candidate) => candidate.id !== entry.id))
    try {
      await deletePlanEntry(entry.id)
    } catch (caught) {
      setError(getErrorMessage(caught))
      await reloadEntries()
    }
  }

  async function handlePaste(toDateISO: string) {
    if (!person || !copiedDate) return
    setBusyAction(true)
    try {
      await copyDay(person.id, copiedDate, toDateISO)
      setCopiedDate(null)
      await reloadEntries()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusyAction(false)
    }
  }

  async function handleDuplicateToNextWeek() {
    if (!person) return
    if (
      !window.confirm(
        'Esto copiará esta semana completa a la semana siguiente, sustituyendo lo que hubiera. ¿Continuar?',
      )
    ) {
      return
    }
    setBusyAction(true)
    try {
      const nextStartISO = toISODate(addDays(weekStart, 7))
      await copyWeek(person.id, weekStartISO, nextStartISO)
      setWeekStart(addDays(weekStart, 7))
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusyAction(false)
    }
  }

  async function handleRepeatPreviousWeek() {
    if (!person) return
    if (!window.confirm('Esto sustituirá esta semana por una copia de la semana anterior. ¿Continuar?')) {
      return
    }
    setBusyAction(true)
    try {
      const previousStartISO = toISODate(addDays(weekStart, -7))
      await copyWeek(person.id, previousStartISO, weekStartISO)
      await reloadEntries()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusyAction(false)
    }
  }

  if (personLoading) return <p className="py-8 text-center text-muted">Cargando…</p>
  if (!person) {
    return (
      <p className="p-6 text-center text-muted">
        Ve a Ajustes y crea al menos una persona para empezar.
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <p className="mb-3.5 font-serif text-[27px] leading-none font-medium text-ink italic">
        {view === 'semana' ? 'Tu semana' : 'Tu mes'}
      </p>
      <PersonSwitcher />

      <div className="mb-3.5 flex gap-1 rounded-2xl bg-track p-1">
        <button
          type="button"
          onClick={() => setView('semana')}
          className={`flex-1 rounded-xl py-2 text-sm font-bold transition-colors ${view === 'semana' ? 'bg-ink text-cream' : 'text-muted'}`}
        >
          Semana
        </button>
        <button
          type="button"
          onClick={() => setView('mes')}
          className={`flex-1 rounded-xl py-2 text-sm font-bold transition-colors ${view === 'mes' ? 'bg-ink text-cream' : 'text-muted'}`}
        >
          Vista mensual
        </button>
      </div>

      {view === 'mes' ? (
        <MonthCalendar person={person} />
      ) : (
        <>
          <div className="mb-3.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink active:scale-90"
              aria-label="Semana anterior"
            >
              <ChevronLeft />
            </button>
            <p className="text-sm font-bold text-ink capitalize">{rangeLabel(days[0], days[6])}</p>
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink active:scale-90"
              aria-label="Semana siguiente"
            >
              <ChevronRight />
            </button>
          </div>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={handleRepeatPreviousWeek}
              disabled={busyAction}
              className="flex-1 rounded-2xl bg-surface py-2.5 text-sm font-bold text-muted disabled:opacity-50"
            >
              Repetir semana anterior
            </button>
            <button
              type="button"
              onClick={handleDuplicateToNextWeek}
              disabled={busyAction}
              className="flex-1 rounded-2xl bg-surface py-2.5 text-sm font-bold text-muted disabled:opacity-50"
            >
              Duplicar → siguiente
            </button>
          </div>

          {copiedDate && (
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-surface px-3.5 py-2.5 text-sm text-gold">
              <span>Día copiado. Toca “Pegar aquí” en el día destino.</span>
              <button type="button" onClick={() => setCopiedDate(null)} className="font-bold underline">
                cancelar
              </button>
            </div>
          )}

          {error && <p className="mb-3 rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}
          <PlanActionNotice notice={householdActions.notice} onUndo={householdActions.undoCopies} />

          {loading ? (
            <p className="py-8 text-center text-muted">Cargando…</p>
          ) : (
            <div className="flex flex-col gap-4">
              {days.map((day) => {
                const dateISO = toISODate(day)
                const dayEntries = entries.filter((entry) => entry.date === dateISO)
                const dayTotals = sumTotals(dayEntries.map(computePlanEntryDetailsTotals))
                const over = dayTotals.kcal > person.target_kcal

                return (
                  <div key={dateISO} className="rounded-[20px] bg-surface p-3.5">
                    <div className="mb-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-ink capitalize">{dayLabel(day)}</p>
                        <p className="flex items-center gap-1.5 text-xs text-muted">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: over ? 'var(--color-over)' : 'var(--color-sage)' }}
                          />
                          {round1(dayTotals.kcal)} / {person.target_kcal} kcal
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setCopiedDate(dateISO)}
                          className="rounded-full bg-bg px-2.5 py-1 font-bold text-muted"
                        >
                          Copiar
                        </button>
                        {copiedDate && copiedDate !== dateISO && (
                          <button
                            type="button"
                            onClick={() => handlePaste(dateISO)}
                            disabled={busyAction}
                            className="rounded-full bg-accent px-2.5 py-1 font-bold text-white"
                          >
                            Pegar aquí
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {MEAL_TYPES.map((mealType) => {
                        const slotEntries = dayEntries.filter((entry) => entry.meal_type === mealType)
                        return (
                          <div key={mealType} className="flex flex-col gap-2">
                            {slotEntries.map((entry) => (
                              <PlanEntryRow
                                key={entry.id}
                                entry={entry}
                                onChangeServings={(servings) =>
                                  handlePatch(entry, buildServingPatch(servings))
                                }
                                onChangeExactQuantity={(quantity) =>
                                  handleExactQuantity(entry, quantity)
                                }
                                onRemove={() => handleRemove(entry)}
                                onReplaceLegacy={() => handleRemove(entry)}
                              />
                            ))}
                            <PlanEntryComposer
                              mealType={mealType}
                              meals={meals}
                              ingredients={ingredients}
                              people={people}
                              currentPersonId={person.id}
                              onAdd={(item) => handleAdd(dateISO, mealType, item)}
                              onEatingOut={(personIds) =>
                                handleEatingOut(dateISO, mealType, personIds)
                              }
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
