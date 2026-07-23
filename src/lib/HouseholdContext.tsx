import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { setActiveHouseholdId } from './householdScope'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'fitmeal:activeHouseholdId'
const LEGACY_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001'

export interface Household {
  id: string
  name: string
  invite_code: string
  created_by: string | null
  weekly_budget: number | null
  created_at: string
}

interface MembershipRow {
  household: Household | Household[]
}

interface HouseholdContextValue {
  households: Household[]
  activeHousehold: Household | null
  loading: boolean
  selectHousehold: (id: string) => void
  reload: () => Promise<void>
  createHousehold: (name: string) => Promise<void>
  updateWeeklyBudget: (budget: number | null) => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

function normalizeHousehold(row: MembershipRow): Household | null {
  if (Array.isArray(row.household)) return row.household[0] ?? null
  return row.household ?? null
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [households, setHouseholds] = useState<Household[]>([])
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
  const [loading, setLoading] = useState(true)

  async function fetchHouseholds(): Promise<Household[]> {
    const { data, error } = await supabase
      .from('household_members')
      .select('household:households(*)')
      .order('created_at')
    if (error) throw error
    return ((data ?? []) as unknown as MembershipRow[])
      .map(normalizeHousehold)
      .filter((h): h is Household => h !== null && h.id !== LEGACY_HOUSEHOLD_ID)
  }

  async function reload() {
    if (!user) {
      setHouseholds([])
      setActiveId(null)
      setActiveHouseholdId(null)
      return
    }

    let list = await fetchHouseholds()
    if (list.length === 0) {
      const { error } = await supabase.rpc('create_household_for_current_user', {
        household_name: 'Mi cuenta',
      })
      if (error) throw error
      list = await fetchHouseholds()
    }

    setHouseholds(list)
    setActiveId((prev) => {
      const stored = prev && list.some((h) => h.id === prev) ? prev : null
      const next = stored ?? list[0]?.id ?? null
      if (next) localStorage.setItem(STORAGE_KEY, next)
      else localStorage.removeItem(STORAGE_KEY)
      setActiveHouseholdId(next)
      return next
    })
  }

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [user?.id])

  const activeHousehold = households.find((h) => h.id === activeId) ?? null

  useEffect(() => {
    setActiveHouseholdId(activeHousehold?.id ?? null)
  }, [activeHousehold?.id])

  const value = useMemo<HouseholdContextValue>(
    () => ({
      households,
      activeHousehold,
      loading,
      selectHousehold(id) {
        setActiveId(id)
        localStorage.setItem(STORAGE_KEY, id)
        setActiveHouseholdId(id)
      },
      reload,
      async createHousehold(name) {
        const { data, error } = await supabase.rpc('create_household_for_current_user', {
          household_name: name,
        })
        if (error) throw error
        const household = data as Household
        await reload()
        setActiveId(household.id)
        localStorage.setItem(STORAGE_KEY, household.id)
        setActiveHouseholdId(household.id)
      },
      async updateWeeklyBudget(budget) {
        if (!activeHousehold) throw new Error('Selecciona un hogar antes de continuar.')
        if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
          throw new Error('El presupuesto no puede ser negativo.')
        }
        const { data, error } = await supabase
          .from('households')
          .update({ weekly_budget: budget })
          .eq('id', activeHousehold.id)
          .select('*')
          .single()
        if (error) throw error
        setHouseholds((current) =>
          current.map((household) =>
            household.id === data.id ? (data as Household) : household,
          ),
        )
      },
    }),
    [activeHousehold, households, loading],
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold debe usarse dentro de HouseholdProvider')
  return ctx
}
