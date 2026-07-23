import { useEffect, useMemo, useState } from 'react'
import type { Ingredient, MealType, Person } from '../types/database'
import type { MealWithLines } from '../lib/meals'
import { MEAL_TYPE_LABELS } from '../data/mealTypes'
import { getErrorMessage } from '../lib/errors'

export type PlanComposerItem =
  | { kind: 'meal'; meal: MealWithLines; servings: number; copyToHousehold: boolean }
  | { kind: 'loose_ingredient'; ingredient: Ingredient; quantity: number; copyToHousehold: boolean }

interface Props {
  mealType: MealType
  meals: MealWithLines[]
  ingredients: Ingredient[]
  people: Person[]
  currentPersonId: string
  openRequest?: number
  onAdd: (item: PlanComposerItem) => Promise<void>
  onEatingOut: (personIds: string[]) => Promise<void>
}

type Mode = 'meal' | 'loose_ingredient' | 'eating_out'
const SERVING_OPTIONS = [0.5, 1, 1.5, 2]

function unitLabel(ingredient: Ingredient): string {
  if (ingredient.default_unit === 'gramos') return 'g'
  if (ingredient.default_unit === 'ml') return 'ml'
  return 'unidades'
}

export function PlanEntryComposer({
  mealType,
  meals,
  ingredients,
  people,
  currentPersonId,
  openRequest = 0,
  onAdd,
  onEatingOut,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('meal')
  const [query, setQuery] = useState('')
  const [selectedMealId, setSelectedMealId] = useState('')
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [servings, setServings] = useState(1)
  const [quantity, setQuantity] = useState('')
  const [copyToHousehold, setCopyToHousehold] = useState(true)
  const [selectedPeople, setSelectedPeople] = useState<string[]>([currentPersonId])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const availableMeals = useMemo(
    () =>
      meals.filter(
        (meal) =>
          meal.meal_types.includes(mealType) &&
          meal.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      ),
    [meals, mealType, query],
  )
  const availableIngredients = useMemo(
    () =>
      ingredients.filter((ingredient) =>
        ingredient.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      ),
    [ingredients, query],
  )
  const selectedMeal = meals.find((meal) => meal.id === selectedMealId) ?? null
  const selectedIngredient =
    ingredients.find((ingredient) => ingredient.id === selectedIngredientId) ?? null

  useEffect(() => {
    if (openRequest <= 0) return
    setMode('meal')
    setQuery('')
    setSelectedMealId('')
    setError('')
    setOpen(true)
  }, [openRequest])

  function resetAndClose() {
    setOpen(false)
    setMode('meal')
    setQuery('')
    setSelectedMealId('')
    setSelectedIngredientId('')
    setServings(1)
    setQuantity('')
    setCopyToHousehold(true)
    setSelectedPeople([currentPersonId])
    setError('')
  }

  function changeMode(next: Mode) {
    setMode(next)
    setQuery('')
    setSelectedMealId('')
    setSelectedIngredientId('')
    setError('')
  }

  async function submit() {
    setError('')
    setSaving(true)
    try {
      if (mode === 'meal') {
        if (!selectedMeal) throw new Error('Selecciona un plato.')
        await onAdd({ kind: 'meal', meal: selectedMeal, servings, copyToHousehold })
      } else if (mode === 'loose_ingredient') {
        if (!selectedIngredient) throw new Error('Selecciona un alimento.')
        const parsedQuantity = Number(quantity.replace(',', '.'))
        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
          throw new Error('Introduce una cantidad mayor que cero.')
        }
        if (
          selectedIngredient.default_unit === 'unidad' &&
          (!selectedIngredient.grams_per_unit || selectedIngredient.grams_per_unit <= 0)
        ) {
          throw new Error(
            'Este alimento necesita tener configurado el peso por unidad para calcular sus macros.',
          )
        }
        await onAdd({
          kind: 'loose_ingredient',
          ingredient: selectedIngredient,
          quantity: parsedQuantity,
          copyToHousehold,
        })
      } else {
        if (selectedPeople.length === 0) throw new Error('Selecciona al menos una persona.')
        await onEatingOut(selectedPeople)
      }
      resetAndClose()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setSelectedPeople([currentPersonId])
          setOpen(true)
        }}
        className="w-full rounded-xl border border-dashed border-track py-2 text-xs font-bold text-muted"
      >
        + Añadir {MEAL_TYPE_LABELS[mealType].toLocaleLowerCase()}
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-track bg-bg p-3">
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-track p-1">
        {(
          [
            ['meal', 'Plato'],
            ['loose_ingredient', 'Alimento suelto'],
            ['eating_out', 'Comemos fuera'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => changeMode(value)}
            className={`rounded-lg px-1 py-2 text-[11px] font-bold ${mode === value ? 'bg-surface text-ink' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode !== 'eating_out' && (
        <>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={mode === 'meal' ? 'Buscar plato…' : 'Buscar alimento…'}
            className="mb-2 w-full rounded-xl border border-track bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="mb-3 max-h-36 space-y-1 overflow-y-auto">
            {(mode === 'meal' ? availableMeals : availableIngredients).map((item) => {
              const selected =
                mode === 'meal' ? selectedMealId === item.id : selectedIngredientId === item.id
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() =>
                    mode === 'meal'
                      ? setSelectedMealId(item.id)
                      : setSelectedIngredientId(item.id)
                  }
                  className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${selected ? 'bg-ink text-cream' : 'bg-surface text-ink'}`}
                >
                  {item.name}
                </button>
              )
            })}
            {(mode === 'meal' ? availableMeals : availableIngredients).length === 0 && (
              <p className="py-2 text-center text-xs text-muted">No hay resultados.</p>
            )}
          </div>
        </>
      )}

      {mode === 'meal' && selectedMeal && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-bold text-ink">Raciones</p>
          <div className="flex gap-1.5">
            {SERVING_OPTIONS.map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setServings(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${servings === value ? 'bg-ink text-cream' : 'bg-surface text-muted'}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'loose_ingredient' && selectedIngredient && (
        <label className="mb-3 block text-xs font-bold text-ink">
          Cantidad exacta ({unitLabel(selectedIngredient)})
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step={selectedIngredient.default_unit === 'unidad' ? '1' : '0.1'}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="mt-1 w-full rounded-xl border border-track bg-surface px-3 py-2 text-sm font-normal outline-none focus:border-accent"
          />
          <span className="mt-1 block font-normal text-muted">
            La unidad viene configurada en el ingrediente y no puede cambiarse aquí.
          </span>
        </label>
      )}

      {mode !== 'eating_out' ? (
        <label className="mb-3 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs font-bold text-ink">
          <input
            type="checkbox"
            checked={copyToHousehold}
            onChange={(event) => setCopyToHousehold(event.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Añadir también al resto de la casa
        </label>
      ) : (
        <fieldset className="mb-3">
          <legend className="mb-1 text-xs font-bold text-ink">¿A quién se aplica?</legend>
          <div className="space-y-1">
            {people.map((person) => (
              <label
                key={person.id}
                className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={selectedPeople.includes(person.id)}
                  onChange={(event) =>
                    setSelectedPeople((current) =>
                      event.target.checked
                        ? [...new Set([...current, person.id])]
                        : current.filter((id) => id !== person.id),
                    )
                  }
                  className="h-4 w-4 accent-accent"
                />
                {person.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {error && <p className="mb-2 text-xs text-over">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetAndClose}
          disabled={saving}
          className="flex-1 rounded-xl border border-track py-2 text-xs font-bold text-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-xl bg-ink py-2 text-xs font-bold text-cream disabled:opacity-50"
        >
          {saving ? 'Guardando…' : mode === 'eating_out' ? 'Marcar' : 'Añadir'}
        </button>
      </div>
    </div>
  )
}
