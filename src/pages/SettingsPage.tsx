import { useEffect, useState } from 'react'
import { listPeople } from '../lib/people'
import { getErrorMessage } from '../lib/errors'
import { PersonCard } from '../components/PersonCard'
import type { Person } from '../types/database'
import { useAuth } from '../lib/AuthContext'
import { useHousehold } from '../lib/HouseholdContext'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { households, activeHousehold, selectHousehold, joinHousehold } = useHousehold()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    setLoading(true)
    listPeople()
      .then(setPeople)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [activeHousehold?.id])

  function handleSaved(updated: Person) {
    setPeople((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  async function copyInviteCode() {
    if (!activeHousehold) return
    await navigator.clipboard.writeText(activeHousehold.invite_code)
    setInviteCopied(true)
    window.setTimeout(() => setInviteCopied(false), 1600)
  }

  async function handleJoin() {
    if (!joinCode.trim()) return
    setJoining(true)
    setError('')
    try {
      await joinHousehold(joinCode)
      setJoinCode('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-24">
      <p className="mb-1 font-serif text-[27px] leading-none font-medium text-ink italic">Ajustes</p>
      <p className="mb-3.5 text-sm text-muted">Nombre, color y objetivos diarios de cada persona.</p>

      <div className="mb-3 flex flex-col gap-3 rounded-[20px] bg-surface p-4">
        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Cuenta</p>
          <p className="mt-1 text-sm font-bold text-ink">{user?.email}</p>
        </div>

        {households.length > 1 && (
          <label className="flex flex-col gap-1 text-sm text-ink">
            Hogar activo
            <select
              className="rounded-xl bg-bg px-3 py-2 text-base text-ink"
              value={activeHousehold?.id ?? ''}
              onChange={(e) => selectHousehold(e.target.value)}
            >
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {activeHousehold && (
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Invitar a tu pareja</p>
            <div className="mt-2 flex gap-2">
              <code className="flex-1 rounded-xl bg-bg px-3 py-2 text-sm font-bold text-ink">
                {activeHousehold.invite_code}
              </code>
              <button onClick={copyInviteCode} className="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-cream">
                {inviteCopied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Unirme a otro hogar</p>
          <div className="mt-2 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl bg-bg px-3 py-2 text-sm text-ink uppercase"
              placeholder="Código"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button
              onClick={handleJoin}
              disabled={joining || !joinCode.trim()}
              className="rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Unirme
            </button>
          </div>
        </div>

        <button onClick={signOut} className="self-start text-sm font-bold text-muted">
          Cerrar sesión
        </button>
      </div>

      {loading && <p className="py-8 text-center text-muted">Cargando...</p>}
      {error && <p className="rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      <div className="flex flex-col gap-3">
        {people.map((person) => (
          <PersonCard key={person.id} person={person} onSaved={handleSaved} />
        ))}
      </div>
    </div>
  )
}
