import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Ingredient } from '../types/database'
import {
  listIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  type IngredientInput,
} from '../lib/ingredients'
import { CATEGORY_LABELS } from '../data/categories'
import { IngredientFormModal } from '../components/IngredientFormModal'
import { getErrorMessage } from '../lib/errors'

export function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Ingredient | null | 'new'>(null)

  async function reload() {
    setLoading(true)
    try {
      setIngredients(await listIngredients())
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ingredients
    return ingredients.filter((i) => i.name.toLowerCase().includes(q))
  }, [ingredients, search])

  async function handleSave(input: IngredientInput) {
    if (editing === 'new') {
      await createIngredient(input)
    } else if (editing) {
      await updateIngredient(editing.id, input)
    }
    setEditing(null)
    await reload()
  }

  async function handleDelete() {
    if (!editing || editing === 'new') return
    if (!confirm(`¿Eliminar "${editing.name}"? Esto no se puede deshacer.`)) return
    await deleteIngredient(editing.id)
    setEditing(null)
    await reload()
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <div className="mb-3.5 flex items-center justify-between">
        <p className="font-serif text-[27px] leading-none font-medium text-ink italic">Ingredientes</p>
        <Link to="/ingredientes/importar" className="rounded-full bg-surface px-3 py-1.5 text-sm font-bold text-accent">
          Importar CSV
        </Link>
      </div>

      <input
        className="mb-3.5 w-full rounded-xl bg-surface px-4 py-3 text-base text-ink placeholder:text-muted"
        placeholder="Buscar ingrediente…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p className="py-8 text-center text-muted">Cargando…</p>}
      {error && <p className="rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      {!loading && !error && (
        <ul className="flex flex-col gap-2">
          {filtered.map((ing) => (
            <li key={ing.id}>
              <button
                onClick={() => setEditing(ing)}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-bg font-serif text-base font-semibold text-accent italic">
                  {ing.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{ing.name}</p>
                  <p className="text-xs text-sage">{CATEGORY_LABELS[ing.category]}</p>
                </div>
                <div className="flex-none text-right text-sm text-muted">
                  <p>{ing.kcal_per_100g} kcal</p>
                  <p className="text-xs">
                    P {ing.protein_per_100g} · C {ing.carbs_per_100g} · G {ing.fat_per_100g}
                  </p>
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-muted">
              No hay ingredientes {search && 'que coincidan con la búsqueda'}.
            </p>
          )}
        </ul>
      )}

      <button
        onClick={() => setEditing('new')}
        className="fixed right-4 bottom-24 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-3xl text-cream shadow-[0_16px_34px_-12px_rgba(35,48,31,0.4)] active:scale-95"
        aria-label="Añadir ingrediente"
      >
        +
      </button>

      {editing && (
        <IngredientFormModal
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onDelete={editing !== 'new' ? handleDelete : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
