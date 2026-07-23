function rawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

export function getErrorMessage(error: unknown): string {
  const message = rawErrorMessage(error).trim()
  if (!message) return 'Ha ocurrido un error inesperado.'

  const normalized = message.toLowerCase()
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('connection')) {
    return 'No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.'
  }
  if (normalized.includes('duplicate key') || normalized.includes('already exists')) {
    return 'Ya existe un registro con esos datos.'
  }
  if (normalized.includes('foreign key') || (normalized.includes('violates') && normalized.includes('constraint'))) {
    return 'No se puede completar porque este elemento está siendo utilizado.'
  }
  if (
    normalized.includes('supabase') ||
    normalized.includes('postgrest') ||
    normalized.includes('postgres') ||
    normalized.includes('pgrst') ||
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('invalid login credentials') ||
    normalized.includes('jwt') ||
    normalized.includes('relation "') ||
    normalized.includes('column "')
  ) {
    return 'No se ha podido completar la acción. Inténtalo de nuevo.'
  }

  return message
}