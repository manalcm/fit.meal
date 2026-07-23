import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260722151530_add_plan_entry_kinds.sql?raw'

describe('contrato de la migración de planificación familiar', () => {
  it('crea copias independientes y conserva por separado el id original', () => {
    expect(migration).toContain('source_entry_id uuid;')
    expect(migration).toContain('copy_entry_id uuid;')
    expect(migration).toContain("p.id <> p_source_person_id")
    expect(migration).toContain("'source_id', source_entry_id")
    expect(migration).toContain("'copy_ids', to_jsonb(copy_entry_ids)")
  })

  it('comprueba la franja de cada persona antes de copiar', () => {
    expect(migration).toMatch(
      /where pe\.person_id = household_person\.id[\s\S]*pe\.date = p_date[\s\S]*pe\.meal_type = p_meal_type/,
    )
    expect(migration).toContain("'skipped', skipped_people")
  })

  it('protege Comemos fuera y limita la ejecución a personas autenticadas', () => {
    expect(migration).toContain('enforce_eating_out_exclusivity')
    expect(migration).toContain('security invoker')
    expect(migration).toContain('from public, anon')
    expect(migration).toContain('to authenticated')
  })
})
