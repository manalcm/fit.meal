import { useEffect, useMemo, useState } from 'react'
import { PlanEntryComposer, type PlanComposerItem } from './PlanEntryComposer'
import { PlanActionNotice } from './PlanActionNotice'
import { PlanEntryRow } from './PlanEntryRow'
import {
  listPlanEntries,
  updatePlanEntry,
  updateLoosePlanEntry,
  deletePlanEntry,
  type PlanEntryWithDetails,
} from '../lib/planEntries'
import { applyServingPatch, buildServingPatch, type ServingPatch } from '../lib/servings'
import { listMeals, type MealWithLines } from '../lib/meals'
import { listIngredients } from '../lib/ingredients'
import { computePlanEntryDetailsTotals, sumTotals, round1 } from '../lib/calculations'
import { toISODate, addMonths, startOfMonth, monthGrid, monthLabel, dayLabel } from '../lib/dates'
import { MEAL_TYPES } from '../data/mealTypes'
import type { Ingredient, MealType, Person } from '../types/database'
import { getErrorMessage } from '../lib/errors'
import { usePerson } from '../lib/PersonContext'
import { useHouseholdPlanActions } from '../lib/useHouseholdPlanActions'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  CartesianGrid,
} from 'recharts'

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface Props {
  person: Person
}

function entryLabel(entry: PlanEntryWithDetails): string {
  if (entry.entry_kind === 'eating_out') return 'Comemos fuera'
  if (entry.entry_kind === 'loose_ingredient') return entry.ingredient?.name ?? 'Alimento suelto'
  return entry.meal?.name ?? 'Plato'
}

export function MonthCalendar({ person }: Props) {
  const { people } = usePerson()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [entries, setEntries] = useState<PlanEntryWithDetails[]>([])
  const [meals, setMeals] = useState<MealWithLines[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showStats, setShowStats] = useState(false)
  const todayISO = toISODate(new Date())
  const [selectedDate, setSelectedDate] = useState(todayISO)

  const weeks = useMemo(() => monthGrid(month), [month])
  const monthStartISO = toISODate(weeks[0][0])
  const monthEndISO = toISODate(weeks[weeks.length - 1][6])

  async function reloadEntries() {
    setEntries(await listPlanEntries(person.id, monthStartISO, monthEndISO))
  }

  const householdActions = useHouseholdPlanActions({
    sourcePersonId: person.id,
    onChanged: reloadEntries,
  })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      listPlanEntries(person.id, monthStartISO, monthEndISO),
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
  }, [person, monthStartISO, monthEndISO])

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

  const daysInThisMonth = useMemo(
    () => weeks.flat().filter((day) => day.getMonth() === month.getMonth()),
    [weeks, month],
  )

  const entriesByDate = useMemo(() => {
    const map = new Map<string, PlanEntryWithDetails[]>()
    for (const entry of entries) {
      const items = map.get(entry.date) ?? []
      items.push(entry)
      map.set(entry.date, items)
    }
    return map
  }, [entries])

  const totalsByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) {
      const totals = computePlanEntryDetailsTotals(entry)
      map.set(entry.date, (map.get(entry.date) ?? 0) + totals.kcal)
    }
    return map
  }, [entries])

  const chartData = useMemo(
    () =>
      daysInThisMonth.map((day) => ({
        day: day.getDate(),
        kcal: round1(totalsByDate.get(toISODate(day)) ?? 0),
      })),
    [daysInThisMonth, totalsByDate],
  )

  const daysWithData = daysInThisMonth.filter(
    (day) => (entriesByDate.get(toISODate(day))?.length ?? 0) > 0,
  )
  const monthTotal = daysWithData.reduce(
    (sum, day) => sum + (totalsByDate.get(toISODate(day)) ?? 0),
    0,
  )
  const avgKcal = daysWithData.length > 0 ? monthTotal / daysWithData.length : 0
  const monthCost = useMemo(
    () => sumTotals(entries.map(computePlanEntryDetailsTotals)).cost,
    [entries],
  )

  const selectedDay = useMemo(
    () => daysInThisMonth.find((day) => toISODate(day) === selectedDate) ?? null,
    [daysInThisMonth, selectedDate],
  )
  const selectedEntries = entriesByDate.get(selectedDate) ?? []

  return (
    <>
      <div className="mb-3.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, -1))}
          className="px-2 py-1 font-bold text-accent"
        >
          ← anterior
        </button>
        <p className="text-sm font-bold text-ink capitalize">{monthLabel(month)}</p>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          className="px-2 py-1 font-bold text-accent"
        >
          siguiente →
        </button>
      </div>

      {error && <p className="mb-3 rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}
      <PlanActionNotice notice={householdActions.notice} onUndo={householdActions.undoCopies} />

      {loading ? (
        <p className="py-8 text-center text-muted">Cargando…</p>
      ) : (
        <>
          <div className="mb-4 rounded-[20px] bg-surface p-2">
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">
              {WEEKDAY_HEADERS.map((header) => (
                <span key={header}>{header}</span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {weeks.map((week, index) => (
                <div key={index} className="grid grid-cols-7 gap-1">
                  {week.map((day) => {
                    const dateISO = toISODate(day)
                    const inMonth = day.getMonth() === month.getMonth()
                    const dayEntries = entriesByDate.get(dateISO) ?? []
                    const mealText = dayEntries.map(entryLabel).join(' · ')
                    const isToday = dateISO === todayISO
                    const isSelected = dateISO === selectedDate

                    return (
                      <button
                        type="button"
                        key={dateISO}
                        onClick={() => setSelectedDate(dateISO)}
                        className={`flex min-h-16 flex-col items-start rounded-xl p-1 text-left transition-colors ${inMonth ? 'bg-bg' : 'bg-transparent'} ${isSelected ? 'ring-2 ring-accent' : isToday ? 'ring-1 ring-sage' : ''}`}
                      >
                        <span className={`text-[11px] font-bold ${inMonth ? 'text-ink' : 'text-track'}`}>
                          {day.getDate()}
                        </span>
                        {inMonth && mealText && (
                          <span className="mt-0.5 line-clamp-2 text-[8px] leading-tight text-accent">
                            {mealText}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {selectedDay && (
            <div className="mb-4 rounded-[20px] bg-surface p-3.5">
              <p className="mb-2 font-bold text-ink capitalize">{dayLabel(selectedDay)}</p>
              <div className="flex flex-col gap-3">
                {MEAL_TYPES.map((mealType) => {
                  const slot = selectedEntries.filter((entry) => entry.meal_type === mealType)
                  return (
                    <div key={mealType} className="flex flex-col gap-2">
                      {slot.map((entry) => (
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
                        onAdd={(item) => handleAdd(selectedDate, mealType, item)}
                        onEatingOut={(personIds) =>
                          handleEatingOut(selectedDate, mealType, personIds)
                        }
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowStats((current) => !current)}
            className="mb-3 w-full rounded-2xl bg-surface py-2.5 text-sm font-bold text-muted"
          >
            {showStats ? 'Ocultar estadísticas ▲' : 'Ver estadísticas ▼'}
          </button>

          {showStats && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[20px] bg-surface p-3 text-center">
                  <p className="text-xs text-muted">Media diaria</p>
                  <p className="font-serif text-lg font-semibold text-ink italic">{round1(avgKcal)} kcal</p>
                </div>
                <div className="rounded-[20px] bg-surface p-3 text-center">
                  <p className="text-xs text-muted">Coste estimado del mes</p>
                  <p className="font-serif text-lg font-semibold text-ink italic">{round1(monthCost)} €</p>
                </div>
              </div>

              <div className="rounded-[20px] bg-surface p-3">
                <p className="mb-2 text-sm font-bold text-ink">Kcal por día</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DAC0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={2} />
                    <YAxis tick={{ fontSize: 10 }} width={32} />
                    <Tooltip
                      formatter={(value) => [`${value} kcal`, 'Kcal']}
                      labelFormatter={(day) => `Día ${day}`}
                    />
                    <ReferenceLine y={person.target_kcal} stroke="#C1613A" strokeDasharray="4 4" />
                    <Bar dataKey="kcal" fill="#7E9468" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
