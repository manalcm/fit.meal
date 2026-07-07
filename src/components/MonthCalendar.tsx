import { useEffect, useMemo, useState } from 'react'
import { AddMealButton } from './AddMealButton'
import { PlanEntryRow } from './PlanEntryRow'
import {
  listPlanEntries,
  createPlanEntry,
  updatePlanEntry,
  deletePlanEntry,
  type PlanEntryWithMeal,
} from '../lib/planEntries'
import { listMeals, type MealWithLines } from '../lib/meals'
import { computePlanEntryTotals, sumTotals, round1 } from '../lib/calculations'
import { toISODate, addMonths, startOfMonth, monthGrid, monthLabel, dayLabel } from '../lib/dates'
import { MEAL_TYPES } from '../data/mealTypes'
import type { MealType, Person } from '../types/database'
import { getErrorMessage } from '../lib/errors'
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

export function MonthCalendar({ person }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [entries, setEntries] = useState<PlanEntryWithMeal[]>([])
  const [meals, setMeals] = useState<MealWithLines[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showStats, setShowStats] = useState(false)
  const todayISO = toISODate(new Date())
  const [selectedDate, setSelectedDate] = useState(todayISO)

  const weeks = useMemo(() => monthGrid(month), [month])
  const monthStartISO = toISODate(weeks[0][0])
  const monthEndISO = toISODate(weeks[weeks.length - 1][6])

  useEffect(() => {
    setLoading(true)
    Promise.all([listPlanEntries(person.id, monthStartISO, monthEndISO), listMeals()])
      .then(([e, m]) => {
        setEntries(e)
        setMeals(m)
        setError('')
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [person, monthStartISO, monthEndISO])

  async function handleAdd(dateISO: string, mealType: MealType, meal: MealWithLines) {
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

  const daysInThisMonth = useMemo(
    () => weeks.flat().filter((d) => d.getMonth() === month.getMonth()),
    [weeks, month],
  )

  const entriesByDate = useMemo(() => {
    const map = new Map<string, PlanEntryWithMeal[]>()
    for (const entry of entries) {
      const arr = map.get(entry.date) ?? []
      arr.push(entry)
      map.set(entry.date, arr)
    }
    return map
  }, [entries])

  const totalsByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) {
      const totals = computePlanEntryTotals(entry.meal.lines, entry)
      map.set(entry.date, (map.get(entry.date) ?? 0) + totals.kcal)
    }
    return map
  }, [entries])

  const chartData = useMemo(
    () =>
      daysInThisMonth.map((d) => ({
        day: d.getDate(),
        kcal: round1(totalsByDate.get(toISODate(d)) ?? 0),
      })),
    [daysInThisMonth, totalsByDate],
  )

  const daysWithData = daysInThisMonth.filter((d) => (totalsByDate.get(toISODate(d)) ?? 0) > 0)
  const monthTotal = daysWithData.reduce((sum, d) => sum + (totalsByDate.get(toISODate(d)) ?? 0), 0)
  const avgKcal = daysWithData.length > 0 ? monthTotal / daysWithData.length : 0
  const monthCost = useMemo(
    () => sumTotals(entries.map((e) => computePlanEntryTotals(e.meal.lines, e))).cost,
    [entries],
  )

  const selectedDay = useMemo(
    () => daysInThisMonth.find((d) => toISODate(d) === selectedDate) ?? null,
    [daysInThisMonth, selectedDate],
  )
  const selectedEntries = entriesByDate.get(selectedDate) ?? []

  return (
    <>
      <div className="mb-3.5 flex items-center justify-between">
        <button onClick={() => setMonth(addMonths(month, -1))} className="px-2 py-1 font-bold text-accent">
          ← anterior
        </button>
        <p className="text-sm font-bold text-ink capitalize">{monthLabel(month)}</p>
        <button onClick={() => setMonth(addMonths(month, 1))} className="px-2 py-1 font-bold text-accent">
          siguiente →
        </button>
      </div>

      {error && <p className="mb-3 rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-muted">Cargando…</p>
      ) : (
        <>
          <div className="mb-4 rounded-[20px] bg-surface p-2">
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">
              {WEEKDAY_HEADERS.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {weeks.map((week, i) => (
                <div key={i} className="grid grid-cols-7 gap-1">
                  {week.map((day) => {
                    const dateISO = toISODate(day)
                    const inMonth = day.getMonth() === month.getMonth()
                    const dayEntries = entriesByDate.get(dateISO) ?? []
                    const mealText = dayEntries.map((e) => e.meal.name).join(' · ')
                    const isToday = dateISO === todayISO
                    const isSelected = dateISO === selectedDate

                    return (
                      <button
                        key={dateISO}
                        onClick={() => setSelectedDate(dateISO)}
                        className={`flex min-h-16 flex-col items-start rounded-xl p-1 text-left transition-colors ${
                          inMonth ? 'bg-bg' : 'bg-transparent'
                        } ${isSelected ? 'ring-2 ring-accent' : isToday ? 'ring-1 ring-sage' : ''}`}
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
                  const slot = selectedEntries.filter((e) => e.meal_type === mealType)
                  return (
                    <div key={mealType} className="flex flex-col gap-2">
                      {slot.map((entry) => (
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
                        onAdd={(meal) => handleAdd(selectedDate, mealType, meal)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowStats((v) => !v)}
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
                      formatter={(v) => [`${v} kcal`, 'Kcal']}
                      labelFormatter={(d) => `Día ${d}`}
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
