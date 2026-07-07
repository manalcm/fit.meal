import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { listPeople } from './people'
import type { Person } from '../types/database'
import { useHousehold } from './HouseholdContext'

const STORAGE_KEY_PREFIX = 'fitmeal:selectedPersonId'

interface PersonContextValue {
  people: Person[]
  selected: Person | null
  selectPerson: (id: string) => void
  loading: boolean
  reload: () => Promise<void>
}

const PersonContext = createContext<PersonContextValue | null>(null)

export function PersonProvider({ children }: { children: ReactNode }) {
  const { activeHousehold } = useHousehold()
  const storageKey = activeHousehold ? `${STORAGE_KEY_PREFIX}:${activeHousehold.id}` : STORAGE_KEY_PREFIX
  const [people, setPeople] = useState<Person[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(storageKey),
  )
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!activeHousehold) return
    const list = await listPeople()
    setPeople(list)
    setSelectedId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev
      const nextId = list[0]?.id ?? null
      if (nextId) {
        localStorage.setItem(storageKey, nextId)
      } else {
        localStorage.removeItem(storageKey)
      }
      return nextId
    })
  }

  useEffect(() => {
    setLoading(true)
    setSelectedId(localStorage.getItem(storageKey))
    reload().finally(() => setLoading(false))
  }, [activeHousehold?.id])

  function selectPerson(id: string) {
    setSelectedId(id)
    localStorage.setItem(storageKey, id)
  }

  const selected = people.find((p) => p.id === selectedId) ?? null

  return (
    <PersonContext.Provider value={{ people, selected, selectPerson, loading, reload }}>
      {children}
    </PersonContext.Provider>
  )
}

export function usePerson() {
  const ctx = useContext(PersonContext)
  if (!ctx) throw new Error('usePerson debe usarse dentro de PersonProvider')
  return ctx
}
