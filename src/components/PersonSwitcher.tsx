import { usePerson } from '../lib/PersonContext'

export function PersonSwitcher() {
  const { people, selected, selectPerson } = usePerson()

  if (people.length === 0) return null

  return (
    <div className="mb-3.5 flex gap-1 rounded-2xl bg-track p-1">
      {people.map((p) => {
        const active = p.id === selected?.id
        return (
          <button
            key={p.id}
            onClick={() => selectPerson(p.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-all active:scale-[0.96]"
            style={{
              backgroundColor: active ? p.color : 'transparent',
              color: active ? '#ffffff' : 'var(--color-muted)',
            }}
          >
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ backgroundColor: active ? '#ffffff' : p.color }}
            />
            {p.name}
          </button>
        )
      })}
    </div>
  )
}
