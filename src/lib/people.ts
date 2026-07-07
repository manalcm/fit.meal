import { supabase } from './supabase'
import type { Person } from '../types/database'
import { requireActiveHouseholdId } from './householdScope'

export type PersonInput = Omit<Person, 'id' | 'household_id' | 'created_at'>

export async function listPeople(): Promise<Person[]> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function updatePerson(id: string, input: PersonInput): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createPerson(input: PersonInput): Promise<Person> {
  const householdId = requireActiveHouseholdId()
  const { data, error } = await supabase
    .from('people')
    .insert({ ...input, household_id: householdId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePerson(id: string): Promise<void> {
  const householdId = requireActiveHouseholdId()
  const { error } = await supabase.from('people').delete().eq('id', id).eq('household_id', householdId)
  if (error) throw error
}
