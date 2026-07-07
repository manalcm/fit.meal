import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { listPeople } from './people'
import type { Person } from '../types/database'

const STORAGE_KEY = 'fitmeal:selectedPersonId'

interface PersonContextValue {
  people: Person[]
  selected: Person | null
  selectPerson: (id: string) => void
  loading: boolean
  reload: () => Promise<void>
}

const PersonContext = createContext<PersonContextValue | null>(null)

export function PersonProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<Person[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  )
  const [loading, setLoading] = useState(true)

  async function reload() {
    const list = await listPeople()
    setPeople(list)
    setSelectedId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev
      return list[0]?.id ?? null
    })
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  function selectPerson(id: string) {
    setSelectedId(id)
    localStorage.setItem(STORAGE_KEY, id)
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
