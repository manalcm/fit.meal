import { useState } from 'react'
import type { FormEvent } from 'react'
import { useHousehold } from '../lib/HouseholdContext'
import { useAuth } from '../lib/AuthContext'
import { getErrorMessage } from '../lib/errors'

export function HouseholdSetupPage() {
  const { createHousehold, joinHousehold } = useHousehold()
  const { signOut } = useAuth()
  const [name, setName] = useState('Mi hogar')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState('')

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setLoading('create')
    setError('')
    try {
      await createHousehold(name)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(null)
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    setLoading('join')
    setError('')
    try {
      await joinHousehold(code)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 bg-bg px-4 py-8">
      <div>
        <p className="font-serif text-[32px] leading-none font-medium text-ink italic">Tu hogar</p>
        <p className="mt-1 text-sm text-muted">Crea un espacio privado o entra al de tu pareja con su código.</p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
        <p className="font-bold text-ink">Crear hogar nuevo</p>
        <input
          className="rounded-xl border border-track bg-bg px-3 py-2.5 text-base text-ink"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading !== null}
          className="rounded-2xl bg-ink py-3 font-bold text-cream disabled:opacity-50"
        >
          {loading === 'create' ? 'Creando...' : 'Crear hogar'}
        </button>
      </form>

      <form onSubmit={handleJoin} className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
        <p className="font-bold text-ink">Unirme a un hogar</p>
        <input
          className="rounded-xl border border-track bg-bg px-3 py-2.5 text-base text-ink uppercase"
          placeholder="Código de invitación"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading !== null || !code.trim()}
          className="rounded-2xl bg-accent py-3 font-bold text-white disabled:opacity-50"
        >
          {loading === 'join' ? 'Entrando...' : 'Unirme'}
        </button>
      </form>

      {error && <p className="rounded-2xl bg-surface p-3 text-sm text-over">{error}</p>}

      <button onClick={signOut} className="py-2 text-sm font-bold text-muted">
        Cerrar sesión
      </button>
    </div>
  )
}
