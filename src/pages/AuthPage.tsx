import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../lib/AuthContext'

const GENERIC_RECOVERY_NOTICE =
  'Si existe una cuenta asociada a este correo, recibirás un enlace para restablecer la contraseña.'

function rawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase()
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' ? message.toLowerCase() : ''
  }
  return ''
}

function safeAuthError(error: unknown, action: 'signin' | 'signup' | 'update'): {
  message: string
  showConfirmationHint: boolean
} {
  const raw = rawErrorMessage(error)

  if (action === 'signin' && (
    raw.includes('invalid login') ||
    raw.includes('email not confirmed') ||
    raw.includes('invalid credentials')
  )) {
    return { message: 'Email o contraseña incorrectos.', showConfirmationHint: true }
  }
  if (raw.includes('rate limit') || raw.includes('too many requests')) {
    return {
      message: 'Has hecho demasiados intentos. Espera unos minutos y vuelve a probar.',
      showConfirmationHint: false,
    }
  }
  if (raw.includes('network') || raw.includes('fetch') || raw.includes('connection')) {
    return {
      message: 'No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.',
      showConfirmationHint: false,
    }
  }
  if (action === 'signin') {
    return { message: 'Email o contraseña incorrectos.', showConfirmationHint: true }
  }
  if (action === 'signup') {
    return {
      message: 'No se ha podido crear la cuenta. Revisa los datos e inténtalo de nuevo.',
      showConfirmationHint: false,
    }
  }
  return {
    message: 'No se ha podido actualizar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.',
    showConfirmationHint: false,
  }
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'

export function AuthPage() {
  const {
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    recoveryMode,
  } = useAuth()
  const [mode, setMode] = useState<AuthMode>(recoveryMode ? 'reset' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmationHint, setShowConfirmationHint] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (recoveryMode) setMode('reset')
  }, [recoveryMode])

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setPassword('')
    setPasswordConfirmation('')
    setError('')
    setShowConfirmationHint(false)
    setNotice('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setShowConfirmationHint(false)
    setNotice('')

    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else if (mode === 'signup') {
        const needsEmailConfirmation = await signUp(email.trim(), password)
        if (needsEmailConfirmation) {
          setNotice('Cuenta creada. Revisa tu correo para confirmarla antes de entrar.')
        }
      } else if (mode === 'forgot') {
        try {
          await requestPasswordReset(email.trim())
        } finally {
          setNotice(GENERIC_RECOVERY_NOTICE)
        }
      } else {
        if (password !== passwordConfirmation) {
          setError('Las contraseñas no coinciden.')
          return
        }
        await updatePassword(password)
        changeMode('signin')
        setNotice('Contraseña actualizada. Ya puedes entrar.')
      }
    } catch (caught) {
      if (mode === 'forgot') {
        setNotice(GENERIC_RECOVERY_NOTICE)
      } else {
        const safeError = safeAuthError(caught, mode === 'reset' ? 'update' : mode)
        setError(safeError.message)
        setShowConfirmationHint(safeError.showConfirmationHint)
      }
    } finally {
      setLoading(false)
    }
  }

  const heading = mode === 'forgot'
    ? 'Recupera tu contraseña'
    : mode === 'reset'
      ? 'Crea una contraseña nueva'
      : mode === 'signin'
        ? 'Entra para ver tu planificación.'
        : 'Crea tu cuenta privada.'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm rounded-[24px] bg-surface p-5 shadow-[0_24px_60px_-36px_rgba(35,48,31,0.55)]">
        <p className="mb-1 font-serif text-[34px] leading-none font-medium text-ink italic">
          fit<span className="text-accent">·</span>meal
        </p>
        <p className="mb-5 text-sm text-muted">{heading}</p>

        {(mode === 'signin' || mode === 'signup') && (
          <div className="mb-4 grid grid-cols-2 rounded-2xl bg-bg p-1">
            <button
              type="button"
              onClick={() => changeMode('signin')}
              className={`rounded-xl py-2 text-sm font-bold ${mode === 'signin' ? 'bg-ink text-cream' : 'text-muted'}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => changeMode('signup')}
              className={`rounded-xl py-2 text-sm font-bold ${mode === 'signup' ? 'bg-ink text-cream' : 'text-muted'}`}
            >
              Crear cuenta
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode !== 'reset' && (
            <label className="flex flex-col gap-1 text-sm text-ink">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                className="rounded-xl border border-track bg-bg px-3 py-2.5 text-base text-ink"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}

          {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
            <label className="flex flex-col gap-1 text-sm text-ink">
              {mode === 'reset' ? 'Nueva contraseña' : 'Contraseña'}
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                className="rounded-xl border border-track bg-bg px-3 py-2.5 text-base text-ink"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}

          {mode === 'signin' && (
            <button
              type="button"
              onClick={() => changeMode('forgot')}
              className="self-start text-sm font-bold text-accent"
            >
              He olvidado mi contraseña
            </button>
          )}

          {mode === 'reset' && (
            <label className="flex flex-col gap-1 text-sm text-ink">
              Repite la contraseña
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="rounded-xl border border-track bg-bg px-3 py-2.5 text-base text-ink"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
              />
            </label>
          )}

          {error && (
            <div className="rounded-2xl bg-bg p-3 text-sm text-over" role="alert">
              <p>{error}</p>
              {showConfirmationHint && (
                <p className="mt-1 text-muted">
                  Si acabas de registrarte, revisa tu correo para confirmar la cuenta.
                </p>
              )}
            </div>
          )}
          {notice && <p className="rounded-2xl bg-bg p-3 text-sm text-sage" role="status">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-2xl bg-accent py-3 font-bold text-white disabled:opacity-50"
          >
            {loading
              ? 'Un momento…'
              : mode === 'signin'
                ? 'Entrar'
                : mode === 'signup'
                  ? 'Crear cuenta'
                  : mode === 'forgot'
                    ? 'Enviar enlace'
                    : 'Guardar contraseña'}
          </button>

          {mode === 'forgot' && (
            <button type="button" onClick={() => changeMode('signin')} className="text-sm font-bold text-muted">
              Volver al acceso
            </button>
          )}
        </form>
      </div>
    </div>
  )
}