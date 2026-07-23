import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  it('oculta nombres de servicios y detalles internos', () => {
    expect(getErrorMessage({ message: 'Supabase PostgREST PGRST116 relation "users" missing' }))
      .toBe('No se ha podido completar la acción. Inténtalo de nuevo.')
  })

  it('conserva los mensajes funcionales definidos por la app', () => {
    expect(getErrorMessage(new Error('Esta franja ya contiene una planificación.')))
      .toBe('Esta franja ya contiene una planificación.')
  })
})
