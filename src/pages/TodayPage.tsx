import { useEffect, useMemo, useState } from 'react'
import { usePerson } from '../lib/PersonContext'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { PlanEntryComposer, type PlanComposerItem } from '../components/PlanEntryComposer'
import { PlanActionNotice } from '../components/PlanActionNotice'
import { PlanEntryRow } from '../components/PlanEntryRow'
import { SurprisePlanner } from '../components/SurprisePlanner'
import { HeroSummary } from '../components/HeroSummary'
import { WaterTracker } from '../components/WaterTracker'
import {
  listPlanEntries,
  updatePlanEntry,
  updateLoosePlanEntry,
  deletePlanEntry,
  type PlanEntryWithDetails,
  type SurprisePlanResult,
} from '../lib/planEntries'
import { applyServingPatch, buildServingPatch, type ServingPatch } from '../lib/servings'
import { listMeals, type MealWithLines } from '../lib/meals'
import { listIngredients } from '../lib/ingredients'
import { computePlanEntryDetailsTotals, sumTotals } from '../lib/calculations'
import { toISODate, dayLabel } from '../lib/dates'
import { MEAL_TYPES } from '../data/mealTypes'
import { getErrorMessage } from '../lib/errors'
import { useHouseholdPlanActions } from '../lib/useHouseholdPlanActions'
import type { Ingredient, MealType } from '../types/database'


export function TodayPage() {
  const { selected: person, people, loading: personLoading } = usePerson()
  const today = useMemo(() => new Date(), [])
  const todayISO = toISODate(today)

  const [entries, setEntries] = useState<PlanEntryWithDetails[]>([])
  const [meals, setMeals] = useState<MealWithLines[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function reloadEntries() {
    if (!person) return
    const next = await listPlanEntries(person.id, todayISO, todayISO)
    setEntries(next)
  }

  const householdActions = useHouseholdPlanActions({
    sourcePersonId: person?.id ?? '',
    onChanged: reloadEntries,
  })

  useEffect(() => {
    if (!person) return
    setLoading(true)
    Promise.all([
      listPlanEntries(person.id, todayISO, todayISO),
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
  }, [person, todayISO])

  async function handleAdd(mealType: MealType, item: PlanComposerItem) {
    await householdActions.addItem(todayISO, mealType, item)
  }

  async function handleEatingOut(mealType: MealType, personIds: string[]) {
    await householdActions.markEatingOut(todayISO, mealType, personIds)
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

  async function handleSurpriseAdded(result: SurprisePlanResult) {
    await reloadEntries()
    const copyIds = result.created
      .filter((created) => created.person_id !== person?.id)
      .map((created) => created.id)
    householdActions.announceHouseholdCopies(copyIds, result.skipped)
  }

  const dayTotals = useMemo(
    () => sumTotals(entries.map(computePlanEntryDetailsTotals)),
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
      <PlanActionNotice notice={householdActions.notice} onUndo={householdActions.undoCopies} />

      <div className="mb-3.5">
        <HeroSummary person={person} totals={dayTotals} />
      </div>

      <WaterTracker person={person} date={todayISO} />

      {loading ? (
        <p className="py-8 text-center text-muted">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">Comidas de hoy</p>
          {MEAL_TYPES.map((mealType) => {
            const dayEntries = entries.filter((entry) => entry.meal_type === mealType)
            return (
              <div key={mealType} className="flex flex-col gap-2">
                {dayEntries.map((entry) => (
                  <PlanEntryRow
                    key={entry.id}
                    entry={entry}
                    onChangeServings={(servings) =>
                      handlePatch(entry, buildServingPatch(servings))
                    }
                    onChangeExactQuantity={(quantity) => handleExactQuantity(entry, quantity)}
                    onRemove={() => handleRemove(entry)}
                    onReplaceLegacy={() => handleRemove(entry)}
                  />
                ))}
                <div id={`plan-composer-${mealType}`}>
                  <PlanEntryComposer
                    mealType={mealType}
                    meals={meals}
                    ingredients={ingredients}
                    people={people}
                    currentPersonId={person.id}
                    onAdd={(item) => handleAdd(mealType, item)}
                    onEatingOut={(personIds) => handleEatingOut(mealType, personIds)}
                  />
                </div>
              </div>
            )
          })}

          <SurprisePlanner
            date={todayISO}
            meals={meals}
            people={people}
            currentPersonId={person.id}
            onAdded={handleSurpriseAdded}
          />
        </div>
      )}
    </div>
  )
}
