import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useHousehold } from '../lib/HouseholdContext'

interface IngredientRowProps {
  ingredient: Ingredient
  open: boolean
  onOpen: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

function IngredientRow({ ingredient, open, onOpen, onClose, onEdit, onDelete }: IngredientRowProps) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const handledSwipe = useRef(false)

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    startY.current = e.clientY
    handledSwipe.current = false
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (startX.current == null || startY.current == null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    startX.current = null
    startY.current = null

    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy)) return
    handledSwipe.current = true
    if (dx < 0) onOpen()
    else onClose()
  }

  function handleClick() {
    if (handledSwipe.current) {
      handledSwipe.current = false
      return
    }
    if (open) onClose()
    else onEdit()
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center rounded-2xl bg-over text-sm font-bold text-white"
      >
        Eliminar
      </button>
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        className="relative z-10 flex w-full touch-pan-y items-center gap-3 rounded-2xl bg-surface p-3 text-left transition-transform duration-200"
        style={{ transform: open ? 'translateX(-96px)' : 'translateX(0)' }}
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-bg font-serif text-base font-semibold text-accent italic">
          {ingredient.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{ingredient.name}</p>
          <p className="text-xs text-sage">{CATEGORY_LABELS[ingredient.category]}</p>
        </div>
        <div className="flex-none text-right text-sm text-muted">
          <p>{ingredient.kcal_per_100g} kcal</p>
          <p className="text-xs">
            P {ingredient.protein_per_100g} · C {ingredient.carbs_per_100g} · G {ingredient.fat_per_100g}
          </p>
        </div>
      </button>
    </div>
  )
}

export function IngredientsPage() {
  const { activeHousehold } = useHousehold()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Ingredient | null | 'new'>(null)
  const [openDeleteId, setOpenDeleteId] = useState<string | null>(null)

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
  }, [activeHousehold?.id])

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

  async function handleDeleteRow(ingredient: Ingredient) {
    if (!confirm(`Eliminar "${ingredient.name}"? Esto no se puede deshacer.`)) return
    try {
      await deleteIngredient(ingredient.id)
      setIngredients((prev) => prev.filter((i) => i.id !== ingredient.id))
      setOpenDeleteId(null)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-40">
      <div className="mb-3.5 flex items-center justify-between">
        <p className="font-serif text-[27px] leading-none font-medium text-ink italic">Ingredientes</p>
        <Link to="/ingredientes/importar" className="rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-accent">
          CSV
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
              <IngredientRow
                ingredient={ing}
                open={openDeleteId === ing.id}
                onOpen={() => setOpenDeleteId(ing.id)}
                onClose={() => setOpenDeleteId(null)}
                onEdit={() => setEditing(ing)}
                onDelete={() => handleDeleteRow(ing)}
              />
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
        className="fixed right-4 bottom-36 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-3xl text-cream shadow-[0_16px_34px_-12px_rgba(35,48,31,0.4)] active:scale-95"
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
