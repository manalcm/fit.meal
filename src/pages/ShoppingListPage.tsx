import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildShoppingList,
  splitPantry,
  groupByCategory,
  formatPackageLine,
  formatShoppingAmount,
  summarizeShoppingList,
  compareShoppingBudget,
  type ShoppingListItem,
} from '../lib/shoppingList'
import { toISODate, addDays, startOfWeek, rangeLabel } from '../lib/dates'
import { INGREDIENT_CATEGORIES, CATEGORY_LABELS } from '../data/categories'
import { getErrorMessage } from '../lib/errors'
import { useHousehold } from '../lib/HouseholdContext'

const CATEGORY_ORDER = INGREDIENT_CATEGORIES.map((category) => category.value)

function formatMoney(value: number): string {
  return `${value.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

function buildShareText(
  groups: { category: string; items: ShoppingListItem[] }[],
  purchaseTotal: number,
  complete: boolean,
): string {
  const lines = ['Estimación semanal — fit·meal', '']
  for (const group of groups) {
    lines.push(`${CATEGORY_LABELS[group.category as keyof typeof CATEGORY_LABELS]}:`)
    for (const item of group.items) {
      const packageLine = formatPackageLine(item)
      lines.push(
        packageLine
          ? `- ${item.ingredient.name}: ${packageLine} (necesitas ${formatShoppingAmount(item.neededQuantity, item.unit)})`
          : `- ${item.ingredient.name}: necesitas ${formatShoppingAmount(item.neededQuantity, item.unit)} — faltan datos del envase`,
      )
    }
    lines.push('')
  }
  lines.push(
    `${complete ? 'Compra estimada' : 'Compra estimada parcial'}: ${formatMoney(purchaseTotal)}`,
  )
  return lines.join('\n')
}

export function ShoppingListPage() {
  const { activeHousehold } = useHousehold()
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
      .catch((caught) => setError(getErrorMessage(caught)))
      .finally(() => setLoading(false))
  }, [activeHousehold?.id, startISO, endISO])

  const { toBuy, inPantry } = useMemo(() => splitPantry(items), [items])
  const groups = useMemo(() => groupByCategory(toBuy, CATEGORY_ORDER), [toBuy])
  const summary = useMemo(() => summarizeShoppingList(toBuy), [toBuy])
  const budget = useMemo(
    () => compareShoppingBudget(activeHousehold?.weekly_budget ?? null, summary),
    [activeHousehold?.weekly_budget, summary],
  )

  function toggleChecked(key: string) {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleShare() {
    const text = buildShareText(groups, summary.purchaseTotal, summary.isComplete)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Estimación semanal', text })
        return
      } catch {
        // Si se cancela el diálogo nativo, se intenta copiar.
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareStatus('Copiado al portapapeles')
      window.setTimeout(() => setShareStatus(''), 2000)
    } catch {
      setShareStatus('No se pudo copiar')
      window.setTimeout(() => setShareStatus(''), 2000)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-24">
      <p className="mb-1 font-serif text-[27px] leading-none font-medium text-ink italic">
        Estimación semanal
      </p>
      <p className="mb-3.5 text-sm text-muted">
        Cantidades necesarias y envases completos para toda la casa.
      </p>

      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="px-2 py-1 font-bold text-accent"
        >
          ← anterior
        </button>
        <p className="text-sm font-bold text-ink capitalize">{rangeLabel(weekStart, weekEnd)}</p>
        <button
          type="button"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="px-2 py-1 font-bold text-accent"
        >
          siguiente →
        </button>
      </div>

      {error && <p className="mb-3 rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-muted">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-muted">
          No hay necesidades domésticas planificadas en estos días.
        </p>
      ) : (
        <>
          {toBuy.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3">
              {groups.map((group) => (
                <section key={group.category} className="rounded-2xl bg-surface p-3.5">
                  <p className="mb-2 text-xs font-bold tracking-wide text-sage uppercase">
                    {CATEGORY_LABELS[group.category]}
                  </p>
                  <div className="flex flex-col gap-3">
                    {group.items.map((item) => {
                      const isChecked = checked.has(item.key)
                      const packageLine = formatPackageLine(item)
                      return (
                        <article
                          key={item.key}
                          className={`rounded-xl bg-bg p-3 ${isChecked ? 'opacity-55' : ''}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleChecked(item.key)}
                              className="mt-0.5 h-[18px] w-[18px] rounded-md accent-sage"
                              aria-label={`Marcar ${item.ingredient.name}`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className={`font-bold text-ink ${isChecked ? 'line-through' : ''}`}>
                                {item.ingredient.name}
                                {packageLine ? ` — ${packageLine}` : ''}
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                Necesitas {formatShoppingAmount(item.neededQuantity, item.unit)}
                                {item.purchasedQuantity != null &&
                                  ` · Comprarías ${formatShoppingAmount(item.purchasedQuantity, item.unit)}`}
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                Consumo:{' '}
                                {item.consumedCost == null
                                  ? 'sin calcular'
                                  : formatMoney(item.consumedCost)}
                                {' · '}Compra:{' '}
                                {item.purchaseCost == null
                                  ? 'sin calcular'
                                  : formatMoney(item.purchaseCost)}
                              </p>

                              <div className="mt-1 space-y-0.5 text-xs font-bold text-over">
                                {item.missingPackageSize && (
                                  <p>Falta configurar el tamaño del envase</p>
                                )}
                                {item.missingPackageUnit && (
                                  <p>Falta configurar la unidad del envase</p>
                                )}
                                {item.missingPrice && <p>Falta configurar el precio</p>}
                                {item.incompatiblePackageUnit && (
                                  <p>
                                    La necesidad está en {formatShoppingAmount(1, item.unit).replace('1 ', '')},
                                    pero el envase usa otra unidad.
                                  </p>
                                )}
                              </div>

                              {(item.missingPackageSize ||
                                item.missingPackageUnit ||
                                item.missingPrice ||
                                item.incompatiblePackageUnit) && (
                                <Link
                                  to={`/ingredientes?editar=${item.ingredient.id}`}
                                  className="mt-1 inline-block text-xs font-bold text-accent underline"
                                >
                                  Configurar ingrediente
                                </Link>
                              )}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="mb-4 rounded-2xl bg-surface p-4 text-sm text-muted">
              Todo lo necesario para esta semana está marcado como disponible en la despensa.
            </p>
          )}

          {inPantry.length > 0 && (
            <details className="mb-4 rounded-2xl bg-surface p-3.5 text-sm">
              <summary className="cursor-pointer font-bold text-muted">
                Disponible en despensa ({inPantry.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-muted">
                {inPantry.map((item) => (
                  <li key={item.key}>
                    {item.ingredient.name} · {formatShoppingAmount(item.neededQuantity, item.unit)}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <section className="mb-4 rounded-2xl bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-bold text-ink">
                {summary.isComplete ? 'Estimación completa' : 'Estimación parcial'}
              </span>
              <span className={summary.isComplete ? 'text-sage' : 'text-gold'}>
                {summary.isComplete ? 'Todos los datos listos' : 'Faltan datos'}
              </span>
            </div>
            {!summary.isComplete && (
              <p className="mb-2 text-xs text-muted">
                {summary.missingPriceCount}{' '}
                {summary.missingPriceCount === 1 ? 'ingrediente' : 'ingredientes'} sin precio ·{' '}
                {summary.missingPackageSizeCount} sin tamaño o unidad de envase.
              </p>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Coste exacto consumido</span>
              <span className="font-bold text-ink">{formatMoney(summary.consumedTotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted">
                {summary.isComplete ? 'Compra estimada' : 'Compra estimada parcial'}
              </span>
              <span className="font-bold text-ink">{formatMoney(summary.purchaseTotal)}</span>
            </div>
          </section>

          {budget && (
            <section className="mb-4 rounded-2xl bg-surface p-4">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">
                Presupuesto semanal
              </p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted">Presupuesto</span>
                <span className="font-bold text-ink">{formatMoney(budget.budget)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted">
                  {budget.isPartial ? 'Compra estimada parcial' : 'Compra estimada'}
                </span>
                <span className="font-bold text-ink">{formatMoney(budget.purchaseTotal)}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg">
                <div
                  className={`h-full rounded-full ${budget.excess > 0 ? 'bg-over' : 'bg-sage'}`}
                  style={{ width: `${budget.progressPercent}%` }}
                />
              </div>
              {budget.isPartial ? (
                <p className="mt-2 text-sm font-bold text-gold">
                  Presupuesto parcial: faltan datos de {budget.incompleteIngredientCount}{' '}
                  {budget.incompleteIngredientCount === 1 ? 'ingrediente' : 'ingredientes'}.
                </p>
              ) : budget.excess > 0 ? (
                <p className="mt-2 text-sm font-bold text-over">
                  Superas el presupuesto en {formatMoney(budget.excess)}.
                </p>
              ) : (
                <p className="mt-2 text-sm font-bold text-sage">
                  Te quedan {formatMoney(budget.remaining)}.
                </p>
              )}
            </section>
          )}

          {toBuy.length > 0 && (
            <button
              type="button"
              onClick={handleShare}
              className="w-full rounded-2xl bg-ink py-2.5 text-sm font-bold text-cream transition-transform active:scale-[0.98]"
            >
              Compartir / copiar estimación
            </button>
          )}
          {shareStatus && <p className="mt-2 text-center text-xs text-muted">{shareStatus}</p>}
        </>
      )}
    </div>
  )
}
