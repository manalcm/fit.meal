import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260722180500_add_surprise_plan_rpc.sql?raw'

describe('contrato atómico de Sorpréndeme', () => {
  it('solo acepta 0,5 o 1 ración y valida que el plato pertenezca a la franja', () => {
    expect(migration).toContain('p_meal_type = any(m.meal_types)')
    expect(migration).toContain("not in (0.5, 1)")
  })

  it('vuelve a comprobar cada franja antes de insertar y no sobrescribe', () => {
    expect(migration).toMatch(
      /where pe\.person_id = assignment_row\.person_id[\s\S]*pe\.date = p_date[\s\S]*pe\.meal_type = p_meal_type/,
    )
    expect(migration).toContain('continue;')
    expect(migration).not.toMatch(/delete from public\.plan_entries/)
  })

  it('crea planificaciones independientes bajo RLS y limita la función a authenticated', () => {
    expect(migration).toContain('security invoker')
    expect(migration).toContain('insert into public.plan_entries')
    expect(migration).toContain('from public, anon')
    expect(migration).toContain('to authenticated')
  })
})
