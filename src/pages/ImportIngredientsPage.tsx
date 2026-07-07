import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { parseIngredientsCsv, type ParseResult } from '../lib/csvImport'
import {
  bulkUpsertIngredients,
  deleteAllIngredients,
  listIngredientNames,
  listIngredients,
} from '../lib/ingredients'
import { BASIC_INGREDIENTS } from '../data/basicIngredients'
import { CATEGORY_LABELS } from '../data/categories'
import { getErrorMessage } from '../lib/errors'

type Step = 'elegir' | 'vista-previa' | 'importando' | 'hecho'

export function ImportIngredientsPage() {
  const [step, setStep] = useState<Step>('elegir')
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [existingCount, setExistingCount] = useState(0)
  const [onConflict, setOnConflict] = useState<'update' | 'skip'>('skip')
  const [summary, setSummary] = useState<{ inserted: number; updated: number; skipped: number } | null>(
    null,
  )
  const [error, setError] = useState('')
  const [basicsMessage, setBasicsMessage] = useState('')
  const [exporting, setExporting] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')

  function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  function csvNumber(value: number): string {
    return String(value).replace('.', ',')
  }

  function escapeCsv(value: string): string {
    return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  }

  async function handleExportCsv() {
    setExporting(true)
    setError('')
    try {
      const ingredients = await listIngredients()
      const lines = [
        'Alimento;kcal;proteina;carbohidratos;grasa',
        ...ingredients.map((ingredient) =>
          [
            escapeCsv(ingredient.name),
            csvNumber(ingredient.kcal_per_100g),
            csvNumber(ingredient.protein_per_100g),
            csvNumber(ingredient.carbs_per_100g),
            csvNumber(ingredient.fat_per_100g),
          ].join(';'),
        ),
      ]
      const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'fitmeal-ingredientes.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteAllIngredients() {
    const confirmed = confirm(
      'Esto borrara todos tus ingredientes y tambien los ingredientes dentro de tus recetas. Tus platos seguiran existiendo, pero sin lista de ingredientes. Quieres continuar?',
    )
    if (!confirmed) return

    const confirmedAgain = confirm('Ultima confirmacion: seguro que quieres vaciar todos los ingredientes?')
    if (!confirmedAgain) return

    setDeletingAll(true)
    setDeleteMessage('')
    setError('')
    try {
      await deleteAllIngredients()
      setExistingCount(0)
      setDeleteMessage('Hecho: se han eliminado todos los ingredientes de esta cuenta.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeletingAll(false)
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError('')
    try {
      const text = await file.text()
      const parsed = parseIngredientsCsv(text)
      const existingNames = await listIngredientNames()
      const conflicts = parsed.rows.filter((r) => existingNames.has(normalizeName(r.input.name)))
      setExistingCount(conflicts.length)
      setResult(parsed)
      setStep('vista-previa')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleConfirmImport() {
    if (!result) return
    setStep('importando')
    try {
      const r = await bulkUpsertIngredients(result.rows.map((row) => row.input), onConflict)
      setSummary(r)
      setStep('hecho')
    } catch (err) {
      setError(getErrorMessage(err))
      setStep('vista-previa')
    }
  }

  async function handleImportBasics() {
    if (!confirm('¿Importar los 25 ingredientes básicos españoles?')) return
    setBasicsMessage('Importando…')
    try {
      const r = await bulkUpsertIngredients(
        BASIC_INGREDIENTS.map((b) => ({ ...b, in_pantry: false })),
        'skip',
      )
      setBasicsMessage(
        `Hecho: ${r.inserted} añadidos, ${r.skipped} ya existían y se dejaron igual.`,
      )
    } catch (err) {
      setBasicsMessage(getErrorMessage(err))
    }
  }

  function reset() {
    setStep('elegir')
    setResult(null)
    setSummary(null)
    setFileName('')
    setError('')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-24">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/ingredientes" className="font-bold text-accent">
          ← Ingredientes
        </Link>
      </div>
      <p className="mb-1 font-serif text-[27px] leading-none font-medium text-ink italic">
        CSV
      </p>
      <p className="mb-3 text-sm text-muted">Importa ingredientes nuevos o exporta tu lista actual.</p>

      {step === 'elegir' && (
        <div className="mt-3 flex flex-col gap-4">
          <div className="rounded-2xl bg-surface p-4">
            <p className="mb-2 font-bold text-ink">Exportar</p>
            <p className="mb-3 text-sm text-muted">
              Descarga todos tus ingredientes en el formato limpio de la app.
            </p>
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              className="w-full rounded-2xl bg-bg py-3 font-bold text-accent disabled:opacity-50"
            >
              {exporting ? 'Preparando...' : 'Exportar CSV'}
            </button>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <p className="mb-2 font-bold text-ink">Importar</p>
            <p className="mb-2 text-sm text-ink">
              Sube un archivo CSV con las columnas:{' '}
              <code className="text-xs text-muted">Alimento, kcal, proteina, carbohidratos, grasa</code>
            </p>
            <p className="mb-3 text-xs text-muted">
              Guarda tu Excel como CSV. Si tu hoja usa proteina sin acento tambien funciona.
            </p>
            <a href="/plantilla-alimentos.csv" download className="mb-3 inline-block text-sm text-accent underline">
              Descargar plantilla de ejemplo
            </a>
            <label className="block w-full cursor-pointer rounded-2xl bg-ink py-3 text-center font-bold text-cream">
              Elegir archivo CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <p className="mb-2 font-bold text-over">Vaciar ingredientes</p>
            <p className="mb-3 text-sm text-muted">
              Elimina todos los ingredientes de esta cuenta para empezar de cero antes de importar un CSV nuevo.
            </p>
            <button
              onClick={handleDeleteAllIngredients}
              disabled={deletingAll}
              className="w-full rounded-2xl bg-over py-3 font-bold text-white disabled:opacity-50"
            >
              {deletingAll ? 'Eliminando...' : 'Eliminar todos los ingredientes'}
            </button>
            {deleteMessage && <p className="mt-2 text-sm text-muted">{deleteMessage}</p>}
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <p className="mb-2 text-sm text-ink">
              ¿Prefieres empezar rápido? Añade 25 ingredientes españoles típicos (huevo, pollo,
              arroz, aceite de oliva…).
            </p>
            <button onClick={handleImportBasics} className="w-full rounded-2xl bg-bg py-3 font-bold text-accent">
              Importar 25 básicos españoles
            </button>
            {basicsMessage && <p className="mt-2 text-sm text-muted">{basicsMessage}</p>}
          </div>
        </div>
      )}

      {error && <p className="mt-3 rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      {step === 'vista-previa' && result && (
        <div className="mt-3 flex flex-col gap-4">
          <p className="text-sm text-muted">Archivo: {fileName}</p>

          {result.headerIssues.length > 0 ? (
            <div className="rounded-2xl bg-surface p-3 text-sm text-over">
              <p className="mb-1 font-bold">El archivo no tiene el formato esperado:</p>
              <p className="mb-2 text-muted">Usa columnas: Alimento, kcal, proteina, carbohidratos, grasa.</p>
              <ul className="list-inside list-disc">
                {result.headerIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <button onClick={reset} className="mt-2 text-sm underline">
                Elegir otro archivo
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl bg-surface p-3">
                  <p className="font-serif text-2xl font-semibold text-ink italic">{result.rows.length}</p>
                  <p className="text-xs text-muted">listos para importar</p>
                </div>
                <div className="rounded-2xl bg-surface p-3">
                  <p className="font-serif text-2xl font-semibold text-gold italic">{result.issues.length}</p>
                  <p className="text-xs text-muted">filas con error (se ignoran)</p>
                </div>
              </div>

              {result.duplicateNames.length > 0 && (
                <p className="text-xs text-muted">
                  {result.duplicateNames.length} nombres repetidos dentro del propio archivo: solo
                  se usó la primera aparición de cada uno.
                </p>
              )}

              {existingCount > 0 && (
                <div className="rounded-2xl bg-surface p-3 text-sm text-ink">
                  <p className="mb-2">
                    {existingCount} de estos ingredientes ya existen en tu base de datos (mismo
                    nombre). ¿Qué quieres hacer con ellos?
                  </p>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={onConflict === 'skip'}
                      onChange={() => setOnConflict('skip')}
                      className="accent-accent"
                    />
                    Dejarlos como están (omitir)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={onConflict === 'update'}
                      onChange={() => setOnConflict('update')}
                      className="accent-accent"
                    />
                    Actualizar sus datos con los del archivo
                  </label>
                </div>
              )}

              {result.issues.length > 0 && (
                <details className="rounded-2xl bg-surface p-3 text-sm">
                  <summary className="cursor-pointer font-bold text-muted">Ver filas con error</summary>
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                    {result.issues.slice(0, 30).map((issue, i) => (
                      <li key={i}>
                        Fila {issue.row}: {issue.message}
                      </li>
                    ))}
                    {result.issues.length > 30 && <li>… y {result.issues.length - 30} más.</li>}
                  </ul>
                </details>
              )}

              <div className="rounded-2xl bg-surface p-3">
                <p className="mb-2 text-sm font-bold text-ink">Vista previa (primeras 8 filas)</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-xs">
                    <thead>
                      <tr className="text-muted">
                        <th className="pr-2">Nombre</th>
                        <th className="pr-2">Categoría</th>
                        <th className="pr-2">Kcal</th>
                        <th className="pr-2">P</th>
                        <th className="pr-2">C</th>
                        <th>G</th>
                      </tr>
                    </thead>
                    <tbody className="text-ink">
                      {result.rows.slice(0, 8).map((r) => (
                        <tr key={r.row}>
                          <td className="py-0.5 pr-2">{r.input.name}</td>
                          <td className="py-0.5 pr-2">{CATEGORY_LABELS[r.input.category]}</td>
                          <td className="py-0.5 pr-2">{r.input.kcal_per_100g}</td>
                          <td className="py-0.5 pr-2">{r.input.protein_per_100g}</td>
                          <td className="py-0.5 pr-2">{r.input.carbs_per_100g}</td>
                          <td className="py-0.5">{r.input.fat_per_100g}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={reset} className="flex-1 rounded-2xl bg-surface py-3 font-bold text-muted">
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={result.rows.length === 0}
                  className="flex-1 rounded-2xl bg-ink py-3 font-bold text-cream disabled:opacity-50"
                >
                  Importar {result.rows.length} ingredientes
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'importando' && <p className="py-8 text-center text-muted">Importando…</p>}

      {step === 'hecho' && summary && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-2xl bg-surface p-4 text-ink">
            <p className="font-bold text-sage">✓ Importación completada</p>
            <p className="text-sm text-muted">
              {summary.inserted} nuevos · {summary.updated} actualizados · {summary.skipped} omitidos
            </p>
          </div>
          <Link to="/ingredientes" className="rounded-2xl bg-ink py-3 text-center font-bold text-cream">
            Ver ingredientes
          </Link>
        </div>
      )}
    </div>
  )
}
