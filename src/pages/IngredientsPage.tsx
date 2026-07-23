import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Ingredient } from '../types/database'
import {
  listIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  deleteUnusedIngredients,
  type BlockedIngredientDeletion,
  type IngredientInput,
} from '../lib/ingredients'
import { CATEGORY_LABELS } from '../data/categories'
import { IngredientFormModal } from '../components/IngredientFormModal'
import { getErrorMessage } from '../lib/errors'
import { useHousehold } from '../lib/HouseholdContext'

interface IngredientRowProps {
  ingredient: Ingredient
  selectionMode: boolean
  selected: boolean
  onEdit: () => void
  onToggle: () => void
}

interface DeletionFeedback {
  deletedCount: number
  blocked: BlockedIngredientDeletion[]
}

const INGREDIENT_RENDER_LIMIT = 120

function IngredientRow({ ingredient, selectionMode, selected, onEdit, onToggle }: IngredientRowProps) {
  return (
    <button
      type="button"
      onClick={selectionMode ? onToggle : onEdit}
      aria-pressed={selectionMode ? selected : undefined}
      className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors ${
        selected ? 'bg-sage/20 ring-2 ring-sage' : 'bg-surface'
      }`}
    >
      {selectionMode && (
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 text-xs font-bold ${
            selected ? 'border-sage bg-sage text-white' : 'border-track text-transparent'
          }`}
        >
          ✓
        </span>
      )}
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
  )
}

export function IngredientsPage() {
  const { activeHousehold } = useHousehold()
  const [searchParams, setSearchParams] = useSearchParams()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Ingredient | null | 'new'>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [deletionFeedback, setDeletionFeedback] = useState<DeletionFeedback | null>(null)

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
    void reload()
  }, [activeHousehold?.id])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return ingredients
    return ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(query))
  }, [ingredients, search])
  const visibleIngredients = useMemo(() => filtered.slice(0, INGREDIENT_RENDER_LIMIT), [filtered])
  const ingredientNames = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.name])),
    [ingredients],
  )

  useEffect(() => {
    const ingredientId = searchParams.get('editar')
    if (!ingredientId) return
    const ingredient = ingredients.find((candidate) => candidate.id === ingredientId)
    if (ingredient) setEditing(ingredient)
  }, [ingredients, searchParams])

  function closeEditor() {
    setEditing(null)
    if (searchParams.has('editar')) setSearchParams({}, { replace: true })
  }

  function cancelSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  function toggleIngredient(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllResults() {
    setSelectedIds(new Set(filtered.map((ingredient) => ingredient.id)))
  }

  async function handleSave(input: IngredientInput) {
    if (editing === 'new') await createIngredient(input)
    else if (editing) await updateIngredient(editing.id, input)
    closeEditor()
    await reload()
  }

  async function handleDelete() {
    if (!editing || editing === 'new') return
    if (!window.confirm(`¿Eliminar "${editing.name}"? Esto no se puede deshacer.`)) return
    const result = await deleteIngredient(editing.id)
    if (result.blocked.length > 0) {
      const mealNames = result.blocked[0].meal_names.join(', ')
      throw new Error(`No se puede eliminar porque se utiliza en: ${mealNames}.`)
    }
    if (!result.deleted_ids.includes(editing.id)) {
      throw new Error('No se pudo eliminar el ingrediente. Vuelve a intentarlo.')
    }
    closeEditor()
    await reload()
  }

  async function handleDeleteSelected() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    if (!window.confirm(`¿Eliminar los ${ids.length} ingredientes seleccionados? Esto no se puede deshacer.`)) {
      return
    }

    setDeletingSelected(true)
    setError('')
    try {
      const result = await deleteUnusedIngredients(ids)
      const deletedIds = new Set(result.deleted_ids)
      setIngredients((current) => current.filter((ingredient) => !deletedIds.has(ingredient.id)))
      setSelectedIds(new Set(result.blocked.map((item) => item.ingredient_id)))
      setDeletionFeedback({ deletedCount: result.deleted_ids.length, blocked: result.blocked })
      if (result.blocked.length === 0) cancelSelection()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setDeletingSelected(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <p className="font-serif text-[27px] leading-none font-medium text-ink italic">Ingredientes</p>
        {!selectionMode && (
          <button
            type="button"
            onClick={() => {
              setSelectionMode(true)
              setDeletionFeedback(null)
            }}
            className="rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-accent"
          >
            Seleccionar
          </button>
        )}
      </div>

      <div className="mb-3.5 flex items-stretch gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl bg-surface px-4 py-3 text-base text-ink placeholder:text-muted"
          placeholder="Buscar ingrediente…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {!selectionMode && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex-none rounded-xl bg-ink px-4 text-sm font-bold text-cream active:scale-[0.98]"
          >
            + Añadir
          </button>
        )}
      </div>

      {selectionMode && (
        <div className="mb-3 flex flex-col gap-2 rounded-2xl bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <b className="text-sm text-ink">{selectedIds.size} seleccionados</b>
            <button type="button" onClick={cancelSelection} className="text-sm font-bold text-muted">
              Cancelar selección
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectAllResults}
              disabled={filtered.length === 0}
              className="rounded-xl bg-bg px-3 py-2 text-xs font-bold text-accent disabled:opacity-50"
            >
              Seleccionar todos los resultados
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || deletingSelected}
              className="rounded-xl bg-over px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {deletingSelected ? 'Eliminando…' : 'Eliminar seleccionados'}
            </button>
          </div>
        </div>
      )}

      {deletionFeedback && (
        <div className="mb-3 rounded-2xl bg-surface p-3 text-sm text-ink" role="status">
          <p>
            {deletionFeedback.deletedCount === 1
              ? 'Se eliminó 1 ingrediente.'
              : `Se eliminaron ${deletionFeedback.deletedCount} ingredientes.`}{' '}
            {deletionFeedback.blocked.length === 1
              ? 'No se eliminó 1 porque se utiliza en platos o planificaciones.'
              : `No se eliminaron ${deletionFeedback.blocked.length} porque se utilizan en platos o planificaciones.`}
          </p>
          {deletionFeedback.blocked.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
              {deletionFeedback.blocked.map((blocked) => (
                <li key={blocked.ingredient_id}>
                  <b className="text-ink">{ingredientNames.get(blocked.ingredient_id) ?? 'Ingrediente'}</b>
                  {' — '}{blocked.meal_names.join(', ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading && <p className="py-8 text-center text-muted">Cargando…</p>}
      {error && <p className="rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      {!loading && !error && (
        <ul className="flex flex-col gap-2">
          {visibleIngredients.map((ingredient) => (
            <li key={ingredient.id}>
              <IngredientRow
                ingredient={ingredient}
                selectionMode={selectionMode}
                selected={selectedIds.has(ingredient.id)}
                onEdit={() => setEditing(ingredient)}
                onToggle={() => toggleIngredient(ingredient.id)}
              />
            </li>
          ))}
          {filtered.length > visibleIngredients.length && (
            <li className="rounded-2xl bg-surface p-3 text-center text-sm text-muted">
              Mostrando {visibleIngredients.length} de {filtered.length}. Usa el buscador para encontrar uno concreto.
            </li>
          )}
          {filtered.length === 0 && (
            <li className="py-8 text-center text-muted">
              No hay ingredientes {search && 'que coincidan con la búsqueda'}.
            </li>
          )}
        </ul>
      )}

      {editing && (
        <IngredientFormModal
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onDelete={editing !== 'new' ? handleDelete : undefined}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}