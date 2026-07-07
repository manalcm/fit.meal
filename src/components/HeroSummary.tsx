import { heroGradient } from '../lib/color'
import { round1 } from '../lib/calculations'
import type { Totals } from '../lib/calculations'
import type { Person } from '../types/database'

interface Props {
  person: Person
  totals: Totals
}

const RING_C = 2 * Math.PI * 50

export function HeroSummary({ person, totals }: Props) {
  const pct = person.target_kcal > 0 ? Math.min(100, (totals.kcal / person.target_kcal) * 100) : 0
  const remaining = Math.max(0, Math.round(person.target_kcal - totals.kcal))
  const offset = RING_C * (1 - pct / 100)

  const macros = [
    { label: 'Proteína', consumed: totals.protein, target: person.target_protein, unit: 'g' },
    { label: 'Carbohidratos', consumed: totals.carbs, target: person.target_carbs, unit: 'g' },
    { label: 'Grasa', consumed: totals.fat, target: person.target_fat, unit: 'g' },
  ]

  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-5"
      style={{ background: heroGradient(person.color) }}
    >
      <div className="pointer-events-none absolute -top-11 -right-11 h-[150px] w-[150px] rounded-full bg-white/10" />
      <div className="relative flex items-center gap-4">
        <div className="relative h-[104px] w-[104px] flex-none">
          <svg width="104" height="104" viewBox="0 0 118 118" className="absolute inset-0 -rotate-90">
            <circle cx="59" cy="59" r="50" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
            <circle
              cx="59"
              cy="59"
              r="50"
              fill="none"
              stroke="#fff"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-xl leading-none font-semibold text-white italic">
              {remaining}
            </span>
            <span className="mt-1 text-[8px] tracking-wide text-white/75 uppercase">kcal rest.</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {macros.map((m) => {
            const mpct = m.target > 0 ? Math.min(100, (m.consumed / m.target) * 100) : 0
            return (
              <div key={m.label}>
                <div className="mb-1 flex justify-between text-[10px]">
                  <span className="font-bold text-white/85">{m.label}</span>
                  <span className="text-white/65">
                    {round1(m.consumed)}/{Math.round(m.target)}
                    {m.unit}
                  </span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{ width: `${mpct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
