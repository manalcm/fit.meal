import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Ingredient, IngredientCategory, IngredientUnit } from '../types/database'
import type { IngredientInput } from '../lib/ingredients'
import { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } from '../data/categories'
import { getErrorMessage } from '../lib/errors'

interface Props {
  initial: Ingredient | null
  onSave: (input: IngredientInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function IngredientFormModal({ initial, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<IngredientCategory>(initial?.category ?? 'otros')
  const [kcal, setKcal] = useState(initial ? String(initial.kcal_per_100g) : '')
  const [protein, setProtein] = useState(initial ? String(initial.protein_per_100g) : '')
  const [carbs, setCarbs] = useState(initial ? String(initial.carbs_per_100g) : '')
  const [fat, setFat] = useState(initial ? String(initial.fat_per_100g) : '')
  const [packagePrice, setPackagePrice] = useState(
    initial?.price_per_kg != null ? String(initial.price_per_kg) : '',
  )
  const [packageGrams, setPackageGrams] = useState(initial?.price_per_kg != null ? '1000' : '')
  const [unit, setUnit] = useState<IngredientUnit>(initial?.default_unit ?? 'gramos')
  const [gramsPerUnit, setGramsPerUnit] = useState(
    initial?.grams_per_unit != null ? String(initial.grams_per_unit) : '',
  )
  const [inPantry, setInPantry] = useState(initial?.in_pantry ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toNum = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')))
  const toNumOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

  function computePricePerKg(): number | null {
    const grams = toNum(packageGrams)
    const price = toNum(packagePrice)
    if (grams <= 0 || price <= 0) return null
    return Math.round((price / grams) * 1000 * 100) / 100
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Ponle un nombre al ingrediente.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        category,
        kcal_per_100g: toNum(kcal),
        protein_per_100g: toNum(protein),
        carbs_per_100g: toNum(carbs),
        fat_per_100g: toNum(fat),
        price_per_kg: computePricePerKg(),
        default_unit: unit,
        grams_per_unit: toNumOrNull(gramsPerUnit),
        in_pantry: inPantry,
      })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-ink/40 sm:items-center sm:justify-center">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-bg p-5 sm:max-w-md sm:rounded-[28px]"
      >
        <h2 className="font-serif text-lg font-medium text-ink italic">
          {initial ? 'Editar ingrediente' : 'Nuevo ingrediente'}
        </h2>

        <label className="flex flex-col gap-1 text-sm text-ink">
          Nombre
          <input
            className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pechuga de pollo"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink">
          Categoría
          <select
            className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
            value={category}
            onChange={(e) => setCategory(e.target.value as IngredientCategory)}
          >
            {INGREDIENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-1 text-xs font-bold tracking-wide text-muted uppercase">Por 100 g</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Kcal
            <input
              inputMode="decimal"
              className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Proteína (g)
            <input
              inputMode="decimal"
              className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Carbohidratos (g)
            <input
              inputMode="decimal"
              className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Grasa (g)
            <input
              inputMode="decimal"
              className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </label>
        </div>

        <p className="mt-1 text-xs font-bold tracking-wide text-muted uppercase">Precio (como lo compras)</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Precio (€)
            <input
              inputMode="decimal"
              className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
              value={packagePrice}
              onChange={(e) => setPackagePrice(e.target.value)}
              placeholder="ej. 2,30"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Cantidad (g o ml)
            <input
              inputMode="decimal"
              className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
              value={packageGrams}
              onChange={(e) => setPackageGrams(e.target.value)}
              placeholder="ej. 500"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Unidad por defecto
            <select
              className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
              value={unit}
              onChange={(e) => setUnit(e.target.value as IngredientUnit)}
            >
              {INGREDIENT_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {unit === 'unidad' && (
          <label className="flex flex-col gap-1 text-sm text-ink">
            Gramos por unidad (ej. 1 huevo = 60 g)
            <input
              inputMode="decimal"
              className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
              value={gramsPerUnit}
              onChange={(e) => setGramsPerUnit(e.target.value)}
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={inPantry}
            onChange={(e) => setInPantry(e.target.checked)}
            className="h-5 w-5 accent-sage"
          />
          Ya lo tengo en la despensa
        </label>

        {error && <p className="text-sm text-over">{error}</p>}

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-surface py-3 font-bold text-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-2xl bg-ink py-3 font-bold text-cream disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {initial && onDelete && (
          <button type="button" onClick={onDelete} className="mt-1 py-2 text-sm text-over">
            Eliminar ingrediente
          </button>
        )}
      </form>
    </div>
  )
}
