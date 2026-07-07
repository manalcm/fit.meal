import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../lib/AuthContext'
import { getErrorMessage } from '../lib/errors'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        const needsEmailConfirmation = await signUp(email.trim(), password)
        if (needsEmailConfirmation) {
          setNotice('Te hemos enviado un correo para confirmar la cuenta.')
        }
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm rounded-[24px] bg-surface p-5 shadow-[0_24px_60px_-36px_rgba(35,48,31,0.55)]">
        <p className="mb-1 font-serif text-[34px] leading-none font-medium text-ink italic">
          fit<span className="text-accent">·</span>meal
        </p>
        <p className="mb-5 text-sm text-muted">
          {mode === 'signin' ? 'Entra para ver tu planificación.' : 'Crea tu cuenta y tu hogar compartido.'}
        </p>

        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-bg p-1">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`rounded-xl py-2 text-sm font-bold ${mode === 'signin' ? 'bg-ink text-cream' : 'text-muted'}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-xl py-2 text-sm font-bold ${mode === 'signup' ? 'bg-ink text-cream' : 'text-muted'}`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              className="rounded-xl border border-track bg-bg px-3 py-2.5 text-base text-ink"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-ink">
            Contraseña
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              className="rounded-xl border border-track bg-bg px-3 py-2.5 text-base text-ink"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="rounded-2xl bg-bg p-3 text-sm text-over">{error}</p>}
          {notice && <p className="rounded-2xl bg-bg p-3 text-sm text-sage">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-2xl bg-accent py-3 font-bold text-white disabled:opacity-50"
          >
            {loading ? 'Un momento...' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
