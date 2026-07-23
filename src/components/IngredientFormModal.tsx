import { useEffect, useState } from 'react'
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
    initial?.package_price != null ? String(initial.package_price) : '',
  )
  const [packageSize, setPackageSize] = useState(
    initial?.package_size != null ? String(initial.package_size) : '',
  )
  const [unit, setUnit] = useState<IngredientUnit>(initial?.default_unit ?? 'gramos')
  const [packageUnit, setPackageUnit] = useState<IngredientUnit>(
    initial?.package_unit ?? initial?.default_unit ?? 'gramos',
  )
  const [gramsPerUnit, setGramsPerUnit] = useState(
    initial?.grams_per_unit != null ? String(initial.grams_per_unit) : '',
  )
  const [inPantry, setInPantry] = useState(initial?.in_pantry ?? false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving && !deleting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [deleting, onClose, saving])

  const toNum = (value: string) => (value.trim() === '' ? 0 : Number(value.replace(',', '.')))
  const toNumOrNull = (value: string) =>
    value.trim() === '' ? null : Number(value.replace(',', '.'))

  function computePricePerKg(): number | null {
    const size = toNum(packageSize)
    const price = toNum(packagePrice)
    if (size <= 0 || price <= 0) return null

    if (packageUnit === 'unidad') {
      const grams = toNum(gramsPerUnit)
      if (grams <= 0) return null
      return Math.round((price / (size * grams)) * 1000 * 100) / 100
    }

    if (packageUnit !== 'gramos') return null
    return Math.round((price / size) * 1000 * 100) / 100
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
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
        price_per_kg: computePricePerKg() ?? initial?.price_per_kg ?? null,
        default_unit: unit,
        grams_per_unit: toNumOrNull(gramsPerUnit),
        in_pantry: inPantry,
        package_price: toNumOrNull(packagePrice),
        package_size: toNumOrNull(packageSize),
        package_unit: toNumOrNull(packageSize) == null ? null : packageUnit,
      })
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    setError('')
    try {
      await onDelete()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setDeleting(false)
    }
  }

  const busy = saving || deleting

  return (
    <div
      className="fixed inset-0 z-[70] flex bg-ink/45 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingredient-form-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <form
        onSubmit={handleSubmit}
        className="flex h-[100dvh] w-full min-h-0 flex-col overflow-hidden bg-bg sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-[28px]"
      >
        <div className="flex-none border-b border-track/50 px-5 py-4">
          <h2 id="ingredient-form-title" className="font-serif text-lg font-medium text-ink italic">
            {initial ? 'Editar ingrediente' : 'Nuevo ingrediente'}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="flex flex-col gap-3 pb-4">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Nombre
              <input
                autoFocus
                className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Pechuga de pollo"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-ink">
              Categoría
              <select
                className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
                value={category}
                onChange={(event) => setCategory(event.target.value as IngredientCategory)}
              >
                {INGREDIENT_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <p className="mt-1 text-xs font-bold tracking-wide text-muted uppercase">
              Por 100 {unit === 'ml' ? 'ml' : 'g'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-ink">
                Kcal
                <input inputMode="decimal" className="rounded-xl bg-surface px-3 py-2 text-base text-ink" value={kcal} onChange={(event) => setKcal(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Proteína (g)
                <input inputMode="decimal" className="rounded-xl bg-surface px-3 py-2 text-base text-ink" value={protein} onChange={(event) => setProtein(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Carbohidratos (g)
                <input inputMode="decimal" className="rounded-xl bg-surface px-3 py-2 text-base text-ink" value={carbs} onChange={(event) => setCarbs(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Grasa (g)
                <input inputMode="decimal" className="rounded-xl bg-surface px-3 py-2 text-base text-ink" value={fat} onChange={(event) => setFat(event.target.value)} />
              </label>
            </div>

            <p className="mt-1 text-xs font-bold tracking-wide text-muted uppercase">Precio (como lo compras)</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-ink">
                Precio (€)
                <input inputMode="decimal" className="rounded-xl bg-surface px-3 py-2 text-base text-ink" value={packagePrice} onChange={(event) => setPackagePrice(event.target.value)} placeholder="ej. 2,30" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Cantidad ({packageUnit === 'unidad' ? 'unidades' : packageUnit === 'ml' ? 'ml' : 'g'})
                <input
                  inputMode="decimal"
                  className="rounded-xl bg-surface px-3 py-2 text-base text-ink"
                  value={packageSize}
                  onChange={(event) => setPackageSize(event.target.value)}
                  placeholder={packageUnit === 'unidad' ? 'ej. 6' : packageUnit === 'ml' ? 'ej. 1000' : 'ej. 500'}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-sm text-ink">
                Unidad del envase
                <select className="rounded-xl bg-surface px-3 py-2 text-base text-ink" value={packageUnit} onChange={(event) => setPackageUnit(event.target.value as IngredientUnit)}>
                  {INGREDIENT_UNITS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm text-ink">
              Unidad por defecto
              <select className="rounded-xl bg-surface px-3 py-2 text-base text-ink" value={unit} onChange={(event) => setUnit(event.target.value as IngredientUnit)}>
                {INGREDIENT_UNITS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            {unit === 'unidad' && (
              <label className="flex flex-col gap-1 text-sm text-ink">
                Gramos por unidad (ej. 1 huevo = 60 g)
                <input inputMode="decimal" className="rounded-xl bg-surface px-3 py-2 text-base text-ink" value={gramsPerUnit} onChange={(event) => setGramsPerUnit(event.target.value)} />
              </label>
            )}

            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={inPantry} onChange={(event) => setInPantry(event.target.checked)} className="h-5 w-5 accent-sage" />
              Ya lo tengo en la despensa
            </label>

            {initial && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="mt-1 rounded-2xl border border-over/20 py-2.5 text-sm font-bold text-over disabled:opacity-50"
              >
                {deleting ? 'Comprobando…' : 'Eliminar ingrediente'}
              </button>
            )}

            {error && <p className="rounded-xl bg-surface p-3 text-sm text-over" role="alert">{error}</p>}
          </div>
        </div>

        <div className="flex flex-none gap-2 border-t border-track/50 bg-bg px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-2xl bg-surface py-3 font-bold text-muted disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="flex-1 rounded-2xl bg-ink py-3 font-bold text-cream disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}