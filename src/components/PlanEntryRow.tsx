import { computePlanEntryTotals, round1 } from '../lib/calculations'
import { MEAL_TYPE_LABELS, MEAL_TYPE_TAG_COLORS } from '../data/mealTypes'
import type { PlanEntryWithMeal } from '../lib/planEntries'

interface Props {
  entry: PlanEntryWithMeal
  onChangePortion: (portion: number) => void
  onChangeGrams: (grams: number) => void
  onUseGrams: () => void
  onUsePortion: () => void
  onRemove: () => void
}

export function PlanEntryRow({
  entry,
  onChangePortion,
  onChangeGrams,
  onUseGrams,
  onUsePortion,
  onRemove,
}: Props) {
  const totals = computePlanEntryTotals(entry.meal.lines, entry)
  const usingGrams = entry.override_grams != null
  const tagColor = MEAL_TYPE_TAG_COLORS[entry.meal_type]

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="h-9 w-[5px] flex-none rounded-full" style={{ backgroundColor: tagColor }} />
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold tracking-wide uppercase"
            style={{ color: tagColor }}
          >
            {MEAL_TYPE_LABELS[entry.meal_type]}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink">{entry.meal.name}</p>
        </div>
        <span className="flex-none text-sm font-bold text-muted">{round1(totals.kcal)} kcal</span>
        <button
          onClick={onRemove}
          className="flex-none px-1 text-lg leading-none text-muted"
          aria-label="Quitar"
        >
          ×
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-track pt-2">
        {usingGrams ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              className="w-20 rounded-lg border border-track bg-bg px-2 py-1 text-sm text-ink"
              value={entry.override_grams ?? 0}
              onChange={(e) => onChangeGrams(Number(e.target.value))}
            />
            <span className="text-xs text-muted">g</span>
            <button onClick={onUsePortion} className="text-xs font-bold text-accent underline">
              usar raciones
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onChangePortion(Math.max(0.5, (entry.portion ?? 1) - 0.5))}
              className="h-7 w-7 rounded-full bg-bg text-muted"
            >
              −
            </button>
            {[0.5, 1, 1.5].map((p) => (
              <button
                key={p}
                onClick={() => onChangePortion(p)}
                className={`rounded-full px-2 py-1 text-xs font-bold ${
                  entry.portion === p ? 'bg-ink text-cream' : 'bg-bg text-muted'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => onChangePortion((entry.portion ?? 1) + 0.5)}
              className="h-7 w-7 rounded-full bg-bg text-muted"
            >
              +
            </button>
            <button onClick={onUseGrams} className="ml-auto text-xs font-bold text-accent underline">
              gramos exactos
            </button>
          </>
        )}
      </div>
    </div>
  )
}
