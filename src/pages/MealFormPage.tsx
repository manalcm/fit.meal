import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { listIngredients } from '../lib/ingredients'
import { getMeal, createMeal, updateMeal, deleteMeal, uploadMealPhoto } from '../lib/meals'
import {
  computeMealPerServingTotals,
  computeMealTotals,
  computeIngredientQuantityTotals,
  ingredientQuantityPerServing,
  round1,
} from '../lib/calculations'
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '../data/mealTypes'
import { getErrorMessage } from '../lib/errors'
import type { Ingredient, IngredientUnit, MealType } from '../types/database'
import { useHousehold } from '../lib/HouseholdContext'

interface Line {
  ingredient: Ingredient
  quantity_grams: number
  quantity: number
  unit: IngredientUnit
}

export function MealFormPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { activeHousehold } = useHousehold()

  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [mealTypes, setMealTypes] = useState<MealType[]>([])
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [recipeServings, setRecipeServings] = useState('1')

  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    listIngredients().then(setAllIngredients).catch((err) => setError(getErrorMessage(err)))
  }, [activeHousehold?.id])

  useEffect(() => {
    if (isNew) return
    getMeal(id!)
      .then((meal) => {
        setName(meal.name)
        setMealTypes(meal.meal_types)
        setNotes(meal.notes ?? '')
        setPhotoUrl(meal.photo_url)
        setRecipeServings(String(meal.recipe_servings ?? 1))
        setLines(meal.lines.map((l) => ({
          ingredient: l.ingredient,
          quantity_grams: l.quantity_grams,
          quantity: l.quantity ?? l.quantity_grams,
          unit: l.unit ?? 'gramos',
        })))
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [activeHousehold?.id, id, isNew])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    const usedIds = new Set(lines.map((l) => l.ingredient.id))
    return allIngredients
      .filter((i) => !usedIds.has(i.id) && i.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [search, allIngredients, lines])

  const totals = useMemo(() => computeMealTotals(lines), [lines])
  const servingsNumber = Number(recipeServings.replace(',', '.'))
  const perServingTotals = useMemo(
    () => computeMealPerServingTotals(lines, servingsNumber),
    [lines, servingsNumber],
  )

  function toggleMealType(t: MealType) {
    setMealTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  function addIngredient(ingredient: Ingredient) {
    const quantity = ingredient.default_unit === 'unidad' ? 1 : 100
    setLines((prev) => [...prev, {
      ingredient,
      quantity_grams: quantity,
      quantity,
      unit: ingredient.default_unit,
    }])
    setSearch('')
  }

  function updateQuantity(ingredientId: string, quantity: number) {
    setLines((prev) =>
      prev.map((l) => (l.ingredient.id === ingredientId ? {
        ...l,
        quantity,
        quantity_grams: quantity,
      } : l)),
    )
  }

  function removeLine(ingredientId: string) {
    setLines((prev) => prev.filter((l) => l.ingredient.id !== ingredientId))
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setError('')
    try {
      setPhotoUrl(await uploadMealPhoto(file))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Ponle un nombre al plato.')
      return
    }
    if (!Number.isFinite(servingsNumber) || servingsNumber <= 0) {
      setError('Indica cuántas raciones produce la receta.')
      return
    }
    setSaving(true)
    setError('')
    const input = {
      name: name.trim(),
      meal_types: mealTypes,
      photo_url: photoUrl,
      notes: notes.trim() || null,
      recipe_servings: servingsNumber,
    }
    const lineInputs = lines.map((l) => ({
      ingredient_id: l.ingredient.id,
      quantity_grams: l.quantity,
      quantity: l.quantity,
      unit: l.unit,
    }))
    try {
      if (isNew) {
        await createMeal(input, lineInputs)
      } else {
        await updateMeal(id!, input, lineInputs)
      }
      navigate('/biblioteca')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!confirm(`¿Eliminar "${name}"? Esto no se puede deshacer.`)) return
    try {
      await deleteMeal(id)
      navigate('/biblioteca')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  if (loading) return <p className="py-8 text-center text-neutral-400">Cargando…</p>

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-32">
      <Link to="/biblioteca" className="mb-3 inline-block font-bold text-accent">
        ← Platos
      </Link>
      <p className="mb-3.5 font-serif text-[27px] leading-none font-medium text-ink italic">
        {isNew ? 'Nuevo plato' : 'Editar plato'}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Nombre
          <input
            className="rounded-xl border border-track bg-surface px-3 py-2 text-base text-ink"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pollo con arroz"
          />
        </label>

        <div>
          <p className="mb-1 text-sm text-ink">Franjas</p>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => toggleMealType(t)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                  mealTypes.includes(t) ? 'bg-accent text-white' : 'bg-surface text-muted'
                }`}
              >
                {MEAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm text-ink">Foto</p>
          {photoUrl && (
            <img src={photoUrl} alt="" className="mb-2 h-32 w-32 rounded-xl object-cover" />
          )}
          <label className="inline-block cursor-pointer rounded-xl bg-surface px-4 py-2 text-sm font-bold text-muted">
            {uploadingPhoto ? 'Subiendo…' : photoUrl ? 'Cambiar foto' : 'Añadir foto'}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-ink">
          Notas (opcional)
          <textarea
            className="rounded-xl border border-track bg-surface px-3 py-2 text-base text-ink"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink">
          ¿Cuántas raciones produce esta receta?
          <input
            type="number"
            min="0.1"
            step="0.1"
            inputMode="decimal"
            required
            className="rounded-xl border border-track bg-surface px-3 py-2 text-base text-ink"
            value={recipeServings}
            onChange={(e) => setRecipeServings(e.target.value)}
            placeholder="Ej. 4"
          />
        </label>

        <div>
          <p className="mb-1 text-sm font-bold text-ink">Ingredientes</p>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-track bg-surface px-3 py-2 text-base text-ink"
              placeholder="Buscar ingrediente para añadir…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {matches.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl bg-surface shadow-lg">
                {matches.map((ing) => (
                  <li key={ing.id}>
                    <button
                      type="button"
                      onClick={() => addIngredient(ing)}
                      className="flex w-full justify-between px-3 py-2 text-left text-sm text-ink hover:bg-bg"
                    >
                      <span>{ing.name}</span>
                      <span className="text-muted">
                        {ing.kcal_per_100g} kcal/{ing.nutrition_unit === 'unidad' ? 'unidad' : `100 ${ing.nutrition_unit === 'ml' ? 'ml' : 'g'}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="mt-2 flex flex-col gap-2">
            {lines.map((l) => (
              <li key={l.ingredient.id} className="flex items-center gap-2 rounded-xl bg-surface p-2">
                <span className="flex-1 text-sm text-ink">{l.ingredient.name}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-20 rounded-lg border border-track bg-bg px-2 py-1 text-right text-sm text-ink"
                  value={l.quantity}
                  min="0.1"
                  step={l.unit === 'unidad' ? '1' : '0.1'}
                  onChange={(e) => updateQuantity(l.ingredient.id, Number(e.target.value))}
                />
                <span className="w-10 text-xs text-muted">
                  {l.unit === 'unidad' ? 'ud.' : l.unit === 'ml' ? 'ml' : 'g'}
                </span>
                <span className="w-16 text-right text-xs text-muted">
                  {round1(computeIngredientQuantityTotals(l.ingredient, l.quantity, l.unit).kcal)} kcal
                </span>
                {servingsNumber > 0 && (
                  <span className="w-20 text-right text-[10px] text-muted">
                    {round1(ingredientQuantityPerServing(l.quantity, servingsNumber))}{' '}
                    {l.unit === 'unidad' ? 'ud.' : l.unit === 'ml' ? 'ml' : 'g'}/ración
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeLine(l.ingredient.id)}
                  className="px-1 text-muted"
                  aria-label={`Quitar ${l.ingredient.name}`}
                >
                  ×
                </button>
              </li>
            ))}
            {lines.length === 0 && (
              <p className="py-3 text-center text-sm text-muted">Añade ingredientes buscándolos arriba.</p>
            )}
          </ul>
        </div>

        <div className="rounded-2xl bg-surface p-3.5">
          <p className="font-serif text-lg text-ink italic">Total del plato</p>
          <p className="text-sm text-muted">
            {round1(totals.kcal)} kcal · Proteína {round1(totals.protein)} g · Carbohidratos{' '}
            {round1(totals.carbs)} g · Grasa {round1(totals.fat)} g
          </p>
          {totals.cost > 0 && <p className="text-xs text-muted">Coste total: {round1(totals.cost)} €</p>}
          {servingsNumber > 0 && (
            <div className="mt-2 border-t border-track pt-2">
              <p className="font-serif text-base text-ink italic">Por ración</p>
              <p className="text-sm text-muted">
                {round1(perServingTotals.kcal)} kcal · Proteína {round1(perServingTotals.protein)} g ·{' '}
                Carbohidratos {round1(perServingTotals.carbs)} g · Grasa {round1(perServingTotals.fat)} g
              </p>
              {totals.cost > 0 && (
                <p className="text-xs text-muted">Coste por ración: {round1(perServingTotals.cost)} €</p>
              )}
            </div>
          )}
        </div>

        {error && <p className="rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-ink py-3 font-bold text-cream disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar plato'}
        </button>

        {!isNew && (
          <button type="button" onClick={handleDelete} className="py-2 text-sm text-over">
            Eliminar plato
          </button>
        )}
      </form>
    </div>
  )
}
