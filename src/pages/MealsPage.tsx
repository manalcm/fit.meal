import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listMeals, type MealWithLines } from '../lib/meals'
import { computeMealTotals, round1 } from '../lib/calculations'
import { MEAL_TYPES, MEAL_TYPE_LABELS, MEAL_TYPE_TAG_COLORS } from '../data/mealTypes'
import { getErrorMessage } from '../lib/errors'
import type { MealType } from '../types/database'
import { useHousehold } from '../lib/HouseholdContext'

export function MealsPage() {
  const [meals, setMeals] = useState<MealWithLines[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<MealType>(MEAL_TYPES[0])
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { activeHousehold } = useHousehold()

  useEffect(() => {
    setLoading(true)
    listMeals()
      .then(setMeals)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [activeHousehold?.id])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return meals.filter((m) => {
      const matchesCategory = m.meal_types.includes(filter)
      const matchesSearch = !q || m.name.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [meals, filter, search])

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <p className="mb-3.5 font-serif text-[27px] leading-none font-medium text-ink italic">Platos</p>

      <div className="mb-3.5 grid w-full grid-cols-4 gap-2 pb-1">
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`min-w-0 rounded-full px-2 py-1.5 text-sm font-bold whitespace-nowrap ${
              filter === t ? 'bg-accent text-white' : 'bg-surface text-muted'
            }`}
          >
            {MEAL_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <input
        className="mb-3.5 w-full rounded-xl bg-surface px-4 py-3 text-base text-ink placeholder:text-muted"
        placeholder="Buscar plato…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p className="py-8 text-center text-muted">Cargando…</p>}
      {error && <p className="rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      {!loading && !error && (
        <ul className="flex flex-col gap-2.5">
          {filtered.map((meal) => {
            const totals = computeMealTotals(meal.lines)
            const tagColor = meal.meal_types[0] ? MEAL_TYPE_TAG_COLORS[meal.meal_types[0]] : 'var(--color-muted)'
            return (
              <li key={meal.id}>
                <button
                  onClick={() => navigate(`/biblioteca/${meal.id}/editar`)}
                  className="flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-surface p-2 text-left"
                  style={{ borderLeft: `6px solid ${tagColor}` }}
                >
                  {meal.photo_url ? (
                    <img src={meal.photo_url} alt="" className="h-14 w-14 flex-none rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-bg text-2xl">
                      🍽️
                    </div>
                  )}
                  <div className="min-w-0 flex-1 py-1 pr-2">
                    <p className="truncate font-bold text-ink">{meal.name}</p>
                    <p className="text-xs text-muted">
                      {meal.meal_types.map((t) => MEAL_TYPE_LABELS[t]).join(' · ') || 'Sin franja'} ·{' '}
                      {round1(totals.kcal)} kcal
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-muted">
              {search ? 'No se encontraron platos que coincidan con la búsqueda.' : 'Todavía no hay platos aquí.'}
            </p>
          )}
        </ul>
      )}

      <Link
        to="/biblioteca/nuevo"
        className="fixed right-4 bottom-24 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-3xl text-cream shadow-[0_16px_34px_-12px_rgba(35,48,31,0.4)] active:scale-95"
        aria-label="Añadir plato"
      >
        +
      </Link>
    </div>
  )
}
