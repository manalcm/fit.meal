import { useEffect, useState } from 'react'
import { listPeople } from '../lib/people'
import { getErrorMessage } from '../lib/errors'
import { PersonCard } from '../components/PersonCard'
import type { Person } from '../types/database'

export function SettingsPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listPeople()
      .then(setPeople)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  function handleSaved(updated: Person) {
    setPeople((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-24">
      <p className="mb-1 font-serif text-[27px] leading-none font-medium text-ink italic">Ajustes</p>
      <p className="mb-3.5 text-sm text-muted">Nombre, color y objetivos diarios de cada persona.</p>

      {loading && <p className="py-8 text-center text-muted">Cargando…</p>}
      {error && <p className="rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      <div className="flex flex-col gap-3">
        {people.map((person) => (
          <PersonCard key={person.id} person={person} onSaved={handleSaved} />
        ))}
      </div>
    </div>
  )
}
