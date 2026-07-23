import { useEffect, useMemo, useState } from 'react'
import type { Person } from '../types/database'

const WATER_STEP_ML = 250

interface Props {
  person: Person
  date: string
}

export function WaterTracker({ person, date }: Props) {
  const storageKey = useMemo(() => `fitmeal:water:${person.id}:${date}`, [date, person.id])
  const [water, setWater] = useState(0)

  useEffect(() => {
    setWater(Number(localStorage.getItem(storageKey) ?? 0))
  }, [storageKey])

  function addWater(delta: number) {
    const next = Math.max(0, water + delta)
    setWater(next)
    localStorage.setItem(storageKey, String(next))
  }

  if (!person.show_water_tracking) return null

  const percentage = person.target_water_ml > 0
    ? Math.min(100, (water / person.target_water_ml) * 100)
    : 0

  return (
    <div className="mb-3.5 rounded-[20px] bg-surface p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wide text-ink uppercase">Agua</span>
        <span className="text-xs text-muted">{water} / {person.target_water_ml} ml</span>
      </div>
      <div className="mb-3 h-3 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            background: 'linear-gradient(90deg,#93A87E,#7E9468)',
          }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => addWater(-WATER_STEP_ML)}
          className="flex-1 rounded-xl border-[1.5px] border-track py-2.5 text-sm font-bold text-muted active:scale-[0.96]"
        >
          − 250 ml
        </button>
        <button
          type="button"
          onClick={() => addWater(WATER_STEP_ML)}
          className="flex-1 rounded-xl bg-ink py-2.5 text-sm font-bold text-cream active:scale-[0.96]"
        >
          + 250 ml
        </button>
      </div>
    </div>
  )
}