import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const providerMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  authCallback: null as null | ((event: string, session: unknown) => void),
  unsubscribe: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: providerMocks.getSession,
      onAuthStateChange: providerMocks.onAuthStateChange,
      signInWithPassword: providerMocks.signInWithPassword,
      signUp: providerMocks.signUp,
      resetPasswordForEmail: providerMocks.resetPasswordForEmail,
      updateUser: providerMocks.updateUser,
      signOut: providerMocks.signOut,
    },
  },
}))

function Probe() {
  const auth = useAuth()
  return (
    <div>
      <span>{auth.loading ? 'cargando' : 'listo'}</span>
      <span>{auth.recoveryMode ? 'recuperando' : 'normal'}</span>
      <button onClick={() => auth.requestPasswordReset('persona@example.com')}>Solicitar</button>
      <button onClick={() => auth.updatePassword('nueva123')}>Actualizar</button>
    </div>
  )
}

describe('AuthProvider recovery', () => {
  beforeEach(() => {
    providerMocks.getSession.mockResolvedValue({ data: { session: null } })
    providerMocks.onAuthStateChange.mockImplementation((callback) => {
      providerMocks.authCallback = callback
      return { data: { subscription: { unsubscribe: providerMocks.unsubscribe } } }
    })
    providerMocks.resetPasswordForEmail.mockResolvedValue({ error: null })
    providerMocks.updateUser.mockResolvedValue({ error: null })
    providerMocks.signOut.mockResolvedValue({ error: null })
  })

  it('envía el enlace al retorno de recuperación y detecta el evento del enlace', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('listo')
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar' }))

    await waitFor(() => expect(providerMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      'persona@example.com',
      { redirectTo: `${window.location.origin}/?recovery=1` },
    ))

    act(() => providerMocks.authCallback?.('PASSWORD_RECOVERY', { user: { id: 'user-1' } }))
    expect(screen.getByText('recuperando')).toBeInTheDocument()
  })

  it('actualiza la contraseña, cierra la sesión local y sale del modo recuperación', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('listo')
    act(() => providerMocks.authCallback?.('PASSWORD_RECOVERY', { user: { id: 'user-1' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

    await waitFor(() => expect(providerMocks.updateUser).toHaveBeenCalledWith({ password: 'nueva123' }))
    expect(providerMocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    await waitFor(() => expect(screen.getByText('normal')).toBeInTheDocument())
  })
})
