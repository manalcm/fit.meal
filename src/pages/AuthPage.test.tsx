import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

const authMocks = vi.hoisted(() => ({
  session: null,
  user: null,
  loading: false,
  recoveryMode: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../lib/AuthContext', () => ({ useAuth: () => authMocks }))

function fillEmailAndPassword() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'persona@example.com' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto123' } })
}

describe('AuthPage', () => {
  beforeEach(() => {
    authMocks.recoveryMode = false
    authMocks.signIn.mockReset()
    authMocks.signUp.mockReset()
    authMocks.requestPasswordReset.mockReset()
    authMocks.updatePassword.mockReset()
  })

  it('muestra un error de acceso seguro sin nombres ni detalles del proveedor', async () => {
    authMocks.signIn.mockRejectedValue(new Error('Invalid login credentials from Supabase Auth'))
    render(<AuthPage />)
    fillEmailAndPassword()
    fireEvent.click(screen.getAllByRole('button', { name: 'Entrar' }).at(-1)!)

    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument()
    expect(screen.getByText('Si acabas de registrarte, revisa tu correo para confirmar la cuenta.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/supabase/i)
    expect(document.body.textContent).not.toMatch(/invalid login/i)
  })

  it('solicita la recuperación sin revelar si el correo existe', async () => {
    authMocks.requestPasswordReset.mockRejectedValue(new Error('User not found in Supabase'))
    render(<AuthPage />)
    fireEvent.click(screen.getByRole('button', { name: 'He olvidado mi contraseña' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'desconocido@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si existe una cuenta asociada a este correo, recibirás un enlace para restablecer la contraseña.',
    )
    expect(authMocks.requestPasswordReset).toHaveBeenCalledWith('desconocido@example.com')
    expect(document.body.textContent).not.toMatch(/user not found|supabase/i)
  })

  it('permite establecer una contraseña nueva y vuelve al acceso', async () => {
    authMocks.recoveryMode = true
    authMocks.updatePassword.mockResolvedValue(undefined)
    render(<AuthPage />)

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'nueva123' } })
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'nueva123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    await waitFor(() => expect(authMocks.updatePassword).toHaveBeenCalledWith('nueva123'))
    expect(screen.getByText('Contraseña actualizada. Ya puedes entrar.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Entrar' })).toHaveLength(2)
  })

  it('rechaza dos contraseñas nuevas diferentes', async () => {
    authMocks.recoveryMode = true
    render(<AuthPage />)
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'nueva123' } })
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'distinta123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(authMocks.updatePassword).not.toHaveBeenCalled()
  })
})
