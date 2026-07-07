import { useEffect, useState } from 'react'
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
  const { activeHousehold } = useHousehold()
  const { reload: reloadSelectedPerson } = usePerson()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

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
