// Los errores de Supabase (PostgrestError) son objetos planos con `message`,
// no instancias de Error, así que `err instanceof Error` los deja pasar de largo.
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message?: unknown }).message
    if (typeof msg === 'string' && msg) return msg
  }
  return 'Ha ocurrido un error inesperado.'
}
