import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260722202000_add_water_visibility_and_safe_ingredient_deletion.sql?raw'

describe('safe ingredient deletion migration', () => {
  it('mantiene el agua visible para las personas existentes sin tocar sus registros', () => {
    expect(migration).toContain('show_water_tracking boolean not null default true')
    expect(migration).not.toMatch(/delete\s+from\s+public\.people/i)
  })

  it('solo borra ingredientes sin referencias y nunca elimina líneas de platos ni planificaciones', () => {
    expect(migration).toContain('not exists (')
    expect(migration).toContain('from public.meal_ingredients mi')
    expect(migration).toContain('from public.plan_entries pe')
    expect(migration).toContain("pe.entry_kind = 'loose_ingredient'")
    expect(migration).not.toMatch(/delete\s+from\s+public\.meal_ingredients/i)
    expect(migration).not.toMatch(/delete\s+from\s+public\.plan_entries/i)
  })

  it('se ejecuta con RLS de la persona autenticada y no queda abierta al público', () => {
    expect(migration).toContain('security invoker')
    expect(migration).toContain('revoke all on function public.delete_unused_ingredients(uuid[]) from public')
    expect(migration).toContain('to authenticated')
  })
})
