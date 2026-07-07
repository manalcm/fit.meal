import { useEffect, useMemo, useState } from 'react'
import { usePerson } from '../lib/PersonContext'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { AddMealButton } from '../components/AddMealButton'
import { PlanEntryRow } from '../components/PlanEntryRow'
import { HeroSummary } from '../components/HeroSummary'
import {
  listPlanEntries,
  createPlanEntry,
  updatePlanEntry,
  deletePlanEntry,
  type PlanEntryWithMeal,
} from '../lib/planEntries'
import { listMeals, type MealWithLines } from '../lib/meals'
import { computePlanEntryTotals, sumTotals } from '../lib/calculations'
import { toISODate, dayLabel } from '../lib/dates'
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '../data/mealTypes'
import { getErrorMessage } from '../lib/errors'
import { generateRandomDay } from '../lib/randomPlan'

const WATER_STEP_ML = 250

export function TodayPage() {
  const { selected: person, loading: personLoading } = usePerson()
  const today = useMemo(() => new Date(), [])
  const todayISO = toISODate(today)

  const [entries, setEntries] = useState<PlanEntryWithMeal[]>([])
  const [meals, setMeals] = useState<MealWithLines[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [randomizing, setRandomizing] = useState(false)
  const [water, setWater] = useState(0)

  const waterKey = person ? `fitmeal:water:${person.id}:${todayISO}` : null

  useEffect(() => {
    if (!person) return
    setLoading(true)
    Promise.all([listPlanEntries(person.id, todayISO, todayISO), listMeals()])
      .then(([e, m]) => {
        setEntries(e)
        setMeals(m)
        setError('')
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [person, todayISO])

  useEffect(() => {
    if (!waterKey) return
    setWater(Number(localStorage.getItem(waterKey) ?? 0))
  }, [waterKey])

  function addWater(delta: number) {
    if (!waterKey) return
    const next = Math.max(0, water + delta)
    setWater(next)
    localStorage.setItem(waterKey, String(next))
  }

  async function handleAdd(mealType: (typeof MEAL_TYPES)[number], meal: MealWithLines) {
    if (!person) return
    try {
      const row = await createPlanEntry({
        person_id: person.id,
        date: todayISO,
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

  async function handlePatch(entry: PlanEntryWithMeal, patch: { portion: number | null; override_grams: number | null }) {
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

  async function handleRandomize() {
    if (!person) return
    if (
      entries.length > 0 &&
      !confirm('Esto sustituirá los platos de hoy por una selección aleatoria dentro de tu objetivo de kcal. ¿Continuar?')
    ) {
      return
    }
    setRandomizing(true)
    setError('')
    setNote('')
    try {
      await Promise.all(entries.map((e) => deletePlanEntry(e.id)))
      const { picks, skipped } = generateRandomDay(meals, person.target_kcal)
      const created = await Promise.all(
        picks.map((p) =>
          createPlanEntry({
            person_id: person.id,
            date: todayISO,
            meal_type: p.mealType,
            meal_id: p.meal.id,
            portion: 1,
            override_grams: null,
          }).then((row) => ({ ...row, meal: p.meal })),
        ),
      )
      setEntries(created)
      if (skipped.length > 0) {
        setNote(
          `No se pudo asignar ${skipped.map((mt) => MEAL_TYPE_LABELS[mt]).join(', ')} sin pasarte de tu objetivo de kcal.`,
        )
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setRandomizing(false)
    }
  }

  const dayTotals = useMemo(
    () => sumTotals(entries.map((e) => computePlanEntryTotals(e.meal.lines, e))),
    [entries],
  )

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
      <p className="font-serif text-[32px] leading-none font-medium text-ink italic">
        fit<span className="text-accent">·</span>meal
      </p>
      <p className="mt-1 mb-3.5 text-xs text-muted capitalize">{dayLabel(today)}</p>

      <PersonSwitcher />

      {error && <p className="mb-3 rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}
      {note && <p className="mb-3 rounded-2xl bg-surface p-3 text-sm text-gold">{note}</p>}

      <div className="mb-3.5">
        <HeroSummary person={person} totals={dayTotals} />
      </div>

      <div className="mb-3.5 rounded-[20px] bg-surface p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-bold tracking-wide text-ink uppercase">Agua</span>
          <span className="text-xs text-muted">
            {water} / {person.target_water_ml} ml
          </span>
        </div>
        <div className="mb-3 h-3 overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (water / person.target_water_ml) * 100)}%`,
              background: 'linear-gradient(90deg,#93A87E,#7E9468)',
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => addWater(-WATER_STEP_ML)}
            className="flex-1 rounded-xl border-[1.5px] border-track py-2.5 text-sm font-bold text-muted active:scale-[0.96]"
          >
            − 250 ml
          </button>
          <button
            onClick={() => addWater(WATER_STEP_ML)}
            className="flex-1 rounded-xl bg-ink py-2.5 text-sm font-bold text-cream active:scale-[0.96]"
          >
            + 250 ml
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">Comidas de hoy</p>
          {MEAL_TYPES.map((mealType) => {
            const dayEntries = entries.filter((e) => e.meal_type === mealType)
            return (
              <div key={mealType} className="flex flex-col gap-2">
                {dayEntries.map((entry) => (
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
                <AddMealButton mealType={mealType} meals={meals} onAdd={(meal) => handleAdd(mealType, meal)} />
              </div>
            )
          })}

          <button
            onClick={handleRandomize}
            disabled={randomizing || meals.length === 0}
            className="mt-2 w-full rounded-2xl bg-surface py-3 text-sm font-bold text-accent transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            🎲 {randomizing ? 'Generando…' : 'Sorpréndeme (aleatorio)'}
          </button>
        </div>
      )}
    </div>
  )
}
