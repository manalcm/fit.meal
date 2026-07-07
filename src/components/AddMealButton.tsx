import { useMemo, useState } from 'react'
import type { MealWithLines } from '../lib/meals'
import type { MealType } from '../types/database'

interface Props {
  mealType: MealType
  meals: MealWithLines[]
  onAdd: (meal: MealWithLines) => void
}

export function AddMealButton({ mealType, meals, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const matches = useMemo(() => {
    const pool = meals.filter((m) => m.meal_types.includes(mealType))
    const q = search.trim().toLowerCase()
    if (!q) return pool.slice(0, 6)
    return pool.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6)
  }, [meals, mealType, search])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl border-[1.5px] border-dashed border-track py-2 text-sm font-bold text-accent transition-transform active:scale-[0.98]"
      >
        + Añadir plato
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-surface p-2">
      <input
        autoFocus
        className="w-full rounded-xl border border-track bg-bg px-2 py-1.5 text-sm text-ink"
        placeholder="Buscar plato…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul className="mt-1 flex flex-col">
        {matches.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => {
                onAdd(m)
                setOpen(false)
                setSearch('')
              }}
              className="w-full rounded-xl px-2 py-1.5 text-left text-sm text-ink hover:bg-bg"
            >
              {m.name}
            </button>
          </li>
        ))}
        {matches.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted">Sin platos para esta franja.</p>
        )}
      </ul>
      <button onClick={() => setOpen(false)} className="mt-1 text-xs text-muted">
        Cancelar
      </button>
    </div>
  )
}
