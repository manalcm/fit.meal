import { useEffect, useState } from 'react'
import { clampServingStep, computePlanEntryDetailsTotals, round1 } from '../lib/calculations'
import { MEAL_TYPE_LABELS, MEAL_TYPE_TAG_COLORS } from '../data/mealTypes'
import type { PlanEntryWithDetails } from '../lib/planEntries'

interface Props {
  entry: PlanEntryWithDetails
  onChangeServings: (servings: number) => void
  onChangeExactQuantity?: (quantity: number) => void
  onRemove: () => void
  onReplaceLegacy?: () => void
}

const QUICK_SERVINGS = [0.5, 1, 1.5, 2]

function unitLabel(entry: PlanEntryWithDetails): string {
  if (entry.exact_unit === 'gramos') return 'g'
  if (entry.exact_unit === 'ml') return 'ml'
  return 'unidades'
}

export function PlanEntryRow({
  entry,
  onChangeServings,
  onChangeExactQuantity,
  onRemove,
  onReplaceLegacy,
}: Props) {
  const totals = computePlanEntryDetailsTotals(entry)
  const isLegacy = entry.entry_kind === 'meal' && entry.planned_servings == null
  const servings = entry.planned_servings ?? 0.5
  const tagColor = MEAL_TYPE_TAG_COLORS[entry.meal_type]
  const [quantityDraft, setQuantityDraft] = useState(String(entry.exact_quantity ?? ''))

  useEffect(() => {
    setQuantityDraft(String(entry.exact_quantity ?? ''))
  }, [entry.exact_quantity])

  function handleReplaceLegacy() {
    if (
      window.confirm(
        'Se eliminará esta planificación antigua para que puedas añadir una nueva. ¿Continuar?',
      )
    ) {
      const replaceLegacy = onReplaceLegacy ?? onRemove
      replaceLegacy()
    }
  }

  function saveExactQuantity() {
    const quantity = Number(quantityDraft.replace(',', '.'))
    if (!Number.isFinite(quantity) || quantity <= 0) return
    onChangeExactQuantity?.(quantity)
  }

  const title =
    entry.entry_kind === 'eating_out'
      ? 'Comemos fuera'
      : entry.entry_kind === 'loose_ingredient'
        ? entry.ingredient?.name ?? 'Alimento suelto'
        : entry.meal?.name ?? 'Plato'

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="h-9 w-[5px] flex-none rounded-full" style={{ backgroundColor: tagColor }} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide uppercase" style={{ color: tagColor }}>
            {MEAL_TYPE_LABELS[entry.meal_type]}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink">{title}</p>
        </div>
        {entry.entry_kind !== 'eating_out' && (
          <span className="flex-none text-sm font-bold text-muted">{round1(totals.kcal)} kcal</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex-none px-1 text-lg leading-none text-muted"
          aria-label={entry.entry_kind === 'eating_out' ? 'Deshacer Comemos fuera' : 'Quitar'}
        >
          ×
        </button>
      </div>

      {entry.entry_kind === 'eating_out' ? (
        <p className="border-t border-track pt-2 text-xs text-muted">
          Esta franja no suma macros, ingredientes ni coste doméstico.
        </p>
      ) : entry.entry_kind === 'loose_ingredient' ? (
        <div className="flex items-end gap-2 border-t border-track pt-2">
          <label className="flex-1 text-xs font-bold text-ink">
            Cantidad exacta ({unitLabel(entry)})
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step={entry.exact_unit === 'unidad' ? '1' : '0.1'}
              value={quantityDraft}
              onChange={(event) => setQuantityDraft(event.target.value)}
              className="mt-1 w-full rounded-xl border border-track bg-bg px-3 py-2 font-normal outline-none focus:border-accent"
            />
          </label>
          <button
            type="button"
            onClick={saveExactQuantity}
            disabled={Number(quantityDraft.replace(',', '.')) === entry.exact_quantity}
            className="rounded-xl bg-ink px-3 py-2 text-xs font-bold text-cream disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      ) : isLegacy ? (
        <div className="border-t border-track pt-2">
          <p className="text-xs font-bold text-gold">Planificación antigua de solo lectura</p>
          <p className="mt-0.5 text-xs text-muted">
            {entry.override_grams != null
              ? `${round1(entry.override_grams)} g originales`
              : 'Cantidad histórica conservada'}
          </p>
          <button
            type="button"
            onClick={handleReplaceLegacy}
            className="mt-2 text-xs font-bold text-accent underline"
          >
            Sustituir manualmente
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-track pt-2">
          <button
            type="button"
            onClick={() => onChangeServings(clampServingStep(servings - 0.5))}
            className="h-7 w-7 rounded-full bg-bg text-muted"
            aria-label="Disminuir media ración"
          >
            −
          </button>
          {QUICK_SERVINGS.map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => onChangeServings(value)}
              className={`rounded-full px-2 py-1 text-xs font-bold ${servings === value ? 'bg-ink text-cream' : 'bg-bg text-muted'}`}
            >
              {value}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChangeServings(servings + 0.5)}
            className="h-7 w-7 rounded-full bg-bg text-muted"
            aria-label="Aumentar media ración"
          >
            +
          </button>
          <span className="ml-auto text-xs text-muted">raciones</span>
        </div>
      )}
    </div>
  )
}
