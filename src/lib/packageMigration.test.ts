import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260722182500_add_package_units_and_weekly_budget.sql?raw'

describe('package and budget migration', () => {
  it('añade únicamente los datos de envase y el presupuesto opcional', () => {
    expect(migration).toContain('add column if not exists package_price numeric')
    expect(migration).toContain('add column if not exists package_size numeric')
    expect(migration).toContain('add column if not exists package_unit public.ingredient_unit')
    expect(migration).toContain('add column if not exists weekly_budget numeric')
  })

  it('no elimina ingredientes, hogares ni valores nutricionales', () => {
    expect(migration).not.toMatch(/delete\s+from/i)
    expect(migration).not.toMatch(/drop\s+column/i)
    expect(migration).not.toMatch(/kcal_per_100g|protein_per_100g|carbs_per_100g|fat_per_100g/i)
  })
})
