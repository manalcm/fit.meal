import { useEffect, useMemo, useState } from 'react'
import {
  buildShoppingList,
  splitPantry,
  groupByCategory,
  formatShoppingQuantity,
  type ShoppingListItem,
} from '../lib/shoppingList'
import { round1 } from '../lib/calculations'
import { toISODate, addDays, startOfWeek, rangeLabel } from '../lib/dates'
import { INGREDIENT_CATEGORIES, CATEGORY_LABELS } from '../data/categories'
import { getErrorMessage } from '../lib/errors'

const CATEGORY_ORDER = INGREDIENT_CATEGORIES.map((c) => c.value)

function buildShareText(
  groups: { category: string; items: ShoppingListItem[] }[],
  totalCost: number,
): string {
  const lines = ['Lista de la compra — fitmeal', '']
  for (const group of groups) {
    lines.push(`${CATEGORY_LABELS[group.category as keyof typeof CATEGORY_LABELS]}:`)
    for (const item of group.items) {
      lines.push(`- ${item.ingredient.name}: ${formatShoppingQuantity(item.ingredient, item.grams)}`)
    }
    lines.push('')
  }
  if (totalCost > 0) lines.push(`Total estimado: ${round1(totalCost)} €`)
  return lines.join('\n')
}

export function ShoppingListPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState('')

  const weekEnd = addDays(weekStart, 6)
  const startISO = toISODate(weekStart)
  const endISO = toISODate(weekEnd)

  useEffect(() => {
    setLoading(true)
    setChecked(new Set())
    buildShoppingList(startISO, endISO)
      .then((list) => {
        setItems(list)
        setError('')
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [startISO, endISO])

  const { toBuy, inPantry } = useMemo(() => splitPantry(items), [items])
  const groups = useMemo(() => groupByCategory(toBuy, CATEGORY_ORDER), [toBuy])
  const totalCost = useMemo(() => toBuy.reduce((sum, i) => sum + i.cost, 0), [toBuy])
  const monthlyCost = totalCost * (30 / 7)

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleShare() {
    const text = buildShareText(groups, totalCost)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lista de la compra', text })
        return
      } catch {
        // el usuario canceló el share nativo; caemos al portapapeles
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareStatus('Copiado al portapapeles')
      setTimeout(() => setShareStatus(''), 2000)
    } catch {
      setShareStatus('No se pudo copiar')
      setTimeout(() => setShareStatus(''), 2000)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-24">
      <p className="mb-3.5 font-serif text-[27px] leading-none font-medium text-ink italic">
        Lista de la compra
      </p>

      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-2 py-1 font-bold text-accent">
          ← anterior
        </button>
        <p className="text-sm font-bold text-ink capitalize">{rangeLabel(weekStart, weekEnd)}</p>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-2 py-1 font-bold text-accent">
          siguiente →
        </button>
      </div>

      {error && <p className="mb-3 rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-muted">Cargando…</p>
      ) : toBuy.length === 0 ? (
        <p className="py-8 text-center text-muted">No hay platos planificados en estos días.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.category} className="rounded-2xl bg-surface p-3.5">
                <p className="mb-2 text-xs font-bold tracking-wide text-sage uppercase">
                  {CATEGORY_LABELS[group.category]}
                </p>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((item) => {
                    const isChecked = checked.has(item.ingredient.id)
                    return (
                      <label key={item.ingredient.id} className="flex items-center gap-2.5 py-0.5 text-sm">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleChecked(item.ingredient.id)}
                          className="h-[18px] w-[18px] rounded-md accent-sage"
                        />
                        <span className={`flex-1 ${isChecked ? 'text-track line-through' : 'text-ink'}`}>
                          {item.ingredient.name}
                        </span>
                        <span className={`text-muted ${isChecked ? 'line-through' : ''}`}>
                          {formatShoppingQuantity(item.ingredient, item.grams)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {inPantry.length > 0 && (
            <details className="mb-4 rounded-2xl bg-surface p-3.5 text-sm">
              <summary className="cursor-pointer font-bold text-muted">
                Ya tienes en despensa ({inPantry.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-muted">
                {inPantry.map((item) => (
                  <li key={item.ingredient.id}>{item.ingredient.name}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="mb-4 flex flex-col gap-1 rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Coste estimado de la semana</span>
              <span className="font-bold text-ink">{round1(totalCost)} €</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Estimación mensual</span>
              <span>{round1(monthlyCost)} €</span>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="w-full rounded-2xl bg-ink py-2.5 text-sm font-bold text-cream transition-transform active:scale-[0.98]"
          >
            Compartir / copiar lista
          </button>
          {shareStatus && <p className="mt-2 text-center text-xs text-muted">{shareStatus}</p>}
        </>
      )}
    </div>
  )
}
