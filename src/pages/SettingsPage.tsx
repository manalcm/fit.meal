import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPerson, listPeople } from '../lib/people'
import { getErrorMessage } from '../lib/errors'
import { PersonCard } from '../components/PersonCard'
import type { Person } from '../types/database'
import { useAuth } from '../lib/AuthContext'
import { useHousehold } from '../lib/HouseholdContext'
import { usePerson } from '../lib/PersonContext'

const COLORS = ['#C1613A', '#7E9468', '#B98A3E', '#5B7145']

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { activeHousehold, updateWeeklyBudget } = useHousehold()
  const { reload: reloadSelectedPerson } = usePerson()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [weeklyBudget, setWeeklyBudget] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const [budgetStatus, setBudgetStatus] = useState('')

  async function reload() {
    setLoading(true)
    try {
      setPeople(await listPeople())
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [activeHousehold?.id])

  useEffect(() => {
    setWeeklyBudget(
      activeHousehold?.weekly_budget == null ? '' : String(activeHousehold.weekly_budget),
    )
    setBudgetStatus('')
  }, [activeHousehold?.id, activeHousehold?.weekly_budget])

  async function handleBudgetSave() {
    const normalized = weeklyBudget.trim().replace(',', '.')
    const budget = normalized === '' ? null : Number(normalized)
    if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
      setBudgetStatus('Introduce un presupuesto válido que no sea negativo.')
      return
    }
    setSavingBudget(true)
    setBudgetStatus('')
    try {
      await updateWeeklyBudget(budget)
      setBudgetStatus(budget == null ? 'Presupuesto desactivado.' : 'Presupuesto guardado.')
    } catch (caught) {
      setBudgetStatus(getErrorMessage(caught))
    } finally {
      setSavingBudget(false)
    }
  }

  function handleSaved(updated: Person) {
    setPeople((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    void reloadSelectedPerson()
  }

  function handleDeleted(personId: string) {
    setPeople((prev) => prev.filter((p) => p.id !== personId))
    void reloadSelectedPerson()
  }

  async function handleCreatePerson() {
    setCreating(true)
    setError('')
    try {
      const nextNumber = people.length + 1
      const person = await createPerson({
        name: `Persona ${nextNumber}`,
        color: COLORS[people.length % COLORS.length],
        target_kcal: 2000,
        target_protein: 120,
        target_carbs: 200,
        target_fat: 60,
        target_water_ml: 2000,
        show_water_tracking: true,
      })
      setPeople((prev) => [...prev, person])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-24">
      <p className="mb-1 font-serif text-[27px] leading-none font-medium text-ink italic">Ajustes</p>
      <p className="mb-3.5 text-sm text-muted">Cuenta y objetivos diarios.</p>

      <div className="mb-3 flex flex-col gap-3 rounded-[20px] bg-surface p-4">
        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Cuenta</p>
          <p className="mt-1 text-sm font-bold text-ink">{user?.email}</p>
        </div>

        <button onClick={signOut} className="self-start text-sm font-bold text-muted">
          Cerrar sesión
        </button>
      </div>

      <div className="mb-4 rounded-[20px] bg-surface p-4">
        <p className="text-xs font-bold tracking-[0.1em] text-muted uppercase">
          Presupuesto semanal de compra
        </p>
        <p className="mt-1 text-xs text-muted">
          Es opcional y se comparte entre todas las personas de la casa.
        </p>
        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1 text-sm text-ink">
            Importe (€)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={weeklyBudget}
              onChange={(event) => setWeeklyBudget(event.target.value)}
              placeholder="Sin presupuesto"
              className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-base text-ink"
            />
          </label>
          <button
            type="button"
            onClick={handleBudgetSave}
            disabled={savingBudget}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-cream disabled:opacity-50"
          >
            {savingBudget ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {budgetStatus && <p className="mt-2 text-xs text-muted">{budgetStatus}</p>}
      </div>

      <div className="mb-4 rounded-[20px] bg-surface p-4">
        <p className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Gestión de datos</p>
        <Link
          to="/ingredientes/importar"
          className="mt-3 flex items-center justify-between rounded-2xl bg-bg px-4 py-3 text-sm font-bold text-accent"
        >
          <span>Importar y exportar ingredientes</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="mb-3.5 flex items-center justify-between">
        <p className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Personas</p>
        <button
          onClick={handleCreatePerson}
          disabled={creating}
          className="rounded-full bg-surface px-3 py-1.5 text-sm font-bold text-accent disabled:opacity-50"
        >
          {creating ? 'Creando...' : 'Añadir'}
        </button>
      </div>

      {loading && <p className="py-8 text-center text-muted">Cargando...</p>}
      {error && <p className="rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      {!loading && !error && people.length === 0 && (
        <p className="rounded-2xl bg-surface p-4 text-sm text-muted">
          Añade una persona para empezar a planificar comidas.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {people.map((person) => (
          <PersonCard key={person.id} person={person} onSaved={handleSaved} onDeleted={handleDeleted} />
        ))}
      </div>
    </div>
  )
}
