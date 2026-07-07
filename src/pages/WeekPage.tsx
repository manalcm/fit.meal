import { useEffect, useMemo, useState } from 'react'
import { usePerson } from '../lib/PersonContext'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { AddMealButton } from '../components/AddMealButton'
import { PlanEntryRow } from '../components/PlanEntryRow'
import { MonthCalendar } from '../components/MonthCalendar'
import {
  listPlanEntries,
  createPlanEntry,
  updatePlanEntry,
  deletePlanEntry,
  copyDay,
  copyWeek,
  type PlanEntryWithMeal,
} from '../lib/planEntries'
import { listMeals, type MealWithLines } from '../lib/meals'
import { computePlanEntryTotals, sumTotals, round1 } from '../lib/calculations'
import { toISODate, addDays, startOfWeek, dayLabel, rangeLabel } from '../lib/dates'
import { MEAL_TYPES } from '../data/mealTypes'
import { getErrorMessage } from '../lib/errors'
import type { MealType } from '../types/database'

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
  const { selected: person, loading: personLoading } = usePerson()
  const [view, setView] = useState<'semana' | 'mes'>('semana')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [entries, setEntries] = useState<PlanEntryWithMeal[]>([])
  const [meals, setMeals] = useState<MealWithLines[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedDate, setCopiedDate] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState(false)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekStartISO = toISODate(weekStart)
  const weekEndISO = toISODate(days[6])

  function reload() {
    if (!person) return
    setLoading(true)
    Promise.all([listPlanEntries(person.id, weekStartISO, weekEndISO), listMeals()])
      .then(([e, m]) => {
        setEntries(e)
        setMeals(m)
        setError('')
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [person, weekStartISO, weekEndISO])

  async function handleAdd(dateISO: string, mealType: MealType, meal: MealWithLines) {
    if (!person) return
    try {
      const row = await createPlanEntry({
        person_id: person.id,
        date: dateISO,
        meal_type: mealType,
        meal_id: meal.id,
        portion: 1,
        override_grams: null,
      })
      setEntries((prev) => [...prev, { ...row, meal }])
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handlePatch(
    entry: PlanEntryWithMeal,
    patch: { portion: number | null; override_grams: number | null },
  ) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)))
    try {
      await updatePlanEntry(entry.id, patch)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleRemove(entry: PlanEntryWithMeal) {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    try {
      await deletePlanEntry(entry.id)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handlePaste(toDateISO: string) {
    if (!person || !copiedDate) return
    setBusyAction(true)
    try {
      await copyDay(person.id, copiedDate, toDateISO)
      setCopiedDate(null)
      reload()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyAction(false)
    }
  }

  async function handleDuplicateToNextWeek() {
    if (!person) return
    if (!confirm('Esto copiará esta semana completa a la semana siguiente, sustituyendo lo que hubiera. ¿Continuar?')) return
    setBusyAction(true)
    try {
      const nextStartISO = toISODate(addDays(weekStart, 7))
      await copyWeek(person.id, weekStartISO, nextStartISO)
      setWeekStart(addDays(weekStart, 7))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyAction(false)
    }
  }

  async function handleRepeatPreviousWeek() {
    if (!person) return
    if (!confirm('Esto sustituirá esta semana por una copia de la semana anterior. ¿Continuar?')) return
    setBusyAction(true)
    try {
      const prevStartISO = toISODate(addDays(weekStart, -7))
      await copyWeek(person.id, prevStartISO, weekStartISO)
      reload()
    } catch (err) {
      setError(getErrorMessage(err))
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
          onClick={() => setView('semana')}
          className={`flex-1 rounded-xl py-2 text-sm font-bold transition-colors ${
            view === 'semana' ? 'bg-ink text-cream' : 'text-muted'
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => setView('mes')}
          className={`flex-1 rounded-xl py-2 text-sm font-bold transition-colors ${
            view === 'mes' ? 'bg-ink text-cream' : 'text-muted'
          }`}
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
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink active:scale-90"
            >
              <ChevronLeft />
            </button>
            <p className="text-sm font-bold text-ink capitalize">{rangeLabel(days[0], days[6])}</p>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink active:scale-90"
            >
              <ChevronRight />
            </button>
          </div>

          <div className="mb-4 flex gap-2">
            <button
              onClick={handleRepeatPreviousWeek}
              disabled={busyAction}
              className="flex-1 rounded-2xl bg-surface py-2.5 text-sm font-bold text-muted disabled:opacity-50"
            >
              Repetir semana anterior
            </button>
            <button
              onClick={handleDuplicateToNextWeek}
              disabled={busyAction}
              className="flex-1 rounded-2xl bg-surface py-2.5 text-sm font-bold text-muted disabled:opacity-50"
            >
              Duplicar → siguiente
            </button>
          </div>

          {copiedDate && (
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-surface px-3.5 py-2.5 text-sm text-gold">
              <span>Día copiado. Toca "Pegar aquí" en el día destino.</span>
              <button onClick={() => setCopiedDate(null)} className="font-bold underline">
                cancelar
              </button>
            </div>
          )}

          {error && <p className="mb-3 rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

          {loading ? (
            <p className="py-8 text-center text-muted">Cargando…</p>
          ) : (
            <div className="flex flex-col gap-4">
              {days.map((day) => {
                const dateISO = toISODate(day)
                const dayEntries = entries.filter((e) => e.date === dateISO)
                const dayTotals = sumTotals(dayEntries.map((e) => computePlanEntryTotals(e.meal.lines, e)))
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
                          onClick={() => setCopiedDate(dateISO)}
                          className="rounded-full bg-bg px-2.5 py-1 font-bold text-muted"
                        >
                          Copiar
                        </button>
                        {copiedDate && copiedDate !== dateISO && (
                          <button
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
                        const slotEntries = dayEntries.filter((e) => e.meal_type === mealType)
                        return (
                          <div key={mealType} className="flex flex-col gap-2">
                            {slotEntries.map((entry) => (
                              <PlanEntryRow
                                key={entry.id}
                                entry={entry}
                                onChangePortion={(p) => handlePatch(entry, { portion: p, override_grams: null })}
                                onChangeGrams={(g) => handlePatch(entry, { portion: null, override_grams: g })}
                                onUseGrams={() => handlePatch(entry, { portion: null, override_grams: 100 })}
                                onUsePortion={() => handlePatch(entry, { portion: 1, override_grams: null })}
                                onRemove={() => handleRemove(entry)}
                              />
                            ))}
                            <AddMealButton
                              mealType={mealType}
                              meals={meals}
                              onAdd={(meal) => handleAdd(dateISO, mealType, meal)}
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
