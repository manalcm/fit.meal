import { useState } from 'react'
import type { Person } from '../types/database'
import { deletePerson, updatePerson, type PersonInput } from '../lib/people'
import { getErrorMessage } from '../lib/errors'

interface Props {
  person: Person
  onSaved: (person: Person) => void
  onDeleted: (personId: string) => void
}

const COLOR_PRESETS = ['#C1613A', '#7E9468', '#B98A3E', '#8B3E24', '#5B7145', '#4C6B8A']

export function PersonCard({ person, onSaved, onDeleted }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(person.name)
  const [color, setColor] = useState(person.color)
  const [kcal, setKcal] = useState(String(person.target_kcal))
  const [protein, setProtein] = useState(String(person.target_protein))
  const [carbs, setCarbs] = useState(String(person.target_carbs))
  const [fat, setFat] = useState(String(person.target_fat))
  const [water, setWater] = useState(String(person.target_water_ml))
  const [showWaterTracking, setShowWaterTracking] = useState(person.show_water_tracking)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function startEditing() {
    setName(person.name)
    setColor(person.color)
    setKcal(String(person.target_kcal))
    setProtein(String(person.target_protein))
    setCarbs(String(person.target_carbs))
    setFat(String(person.target_fat))
    setWater(String(person.target_water_ml))
    setShowWaterTracking(person.show_water_tracking)
    setError('')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const input: PersonInput = {
        name: name.trim() || person.name,
        color,
        target_kcal: Number(kcal) || 0,
        target_protein: Number(protein) || 0,
        target_carbs: Number(carbs) || 0,
        target_fat: Number(fat) || 0,
        target_water_ml: Number(water) || 0,
        show_water_tracking: showWaterTracking,
      }
      const updated = await updatePerson(person.id, input)
      onSaved(updated)
      setEditing(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Eliminar ${person.name}? Tambien se borrara su plan asociado.`)
    if (!confirmed) return

    setDeleting(true)
    setError('')
    try {
      await deletePerson(person.id)
      onDeleted(person.id)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  if (!editing) {
    return (
      <div className="rounded-[20px] bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-[30px] w-[30px] flex-none rounded-full" style={{ backgroundColor: person.color }} />
            <span className="text-base font-bold text-ink">{person.name}</span>
          </div>
          <button onClick={startEditing} className="text-xs font-bold text-accent">
            Editar
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted">
          <div className="rounded-2xl bg-bg px-3 py-2">
            Kcal <b className="text-ink">{person.target_kcal}</b>
          </div>
          {person.show_water_tracking && (
            <div className="rounded-2xl bg-bg px-3 py-2">
              Agua <b className="text-ink">{person.target_water_ml}</b>
            </div>
          )}
          <div className="rounded-2xl bg-bg px-3 py-2">
            Prot. <b className="text-ink">{person.target_protein}g</b>
          </div>
          <div className="rounded-2xl bg-bg px-3 py-2">
            Grasa <b className="text-ink">{person.target_fat}g</b>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
      <input
        className="rounded-xl bg-bg px-3 py-2 text-base font-bold text-ink"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div>
        <p className="mb-1.5 text-sm text-ink">Color</p>
        <div className="flex flex-wrap gap-2.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className="h-8 w-8 rounded-full transition-transform active:scale-90"
              style={{
                backgroundColor: c,
                boxShadow: color === c ? '0 0 0 2px var(--color-surface), 0 0 0 4px ' + c : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Kcal objetivo
          <input
            inputMode="decimal"
            className="rounded-xl bg-bg px-3 py-2 text-base text-ink"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Agua objetivo (ml)
          <input
            inputMode="decimal"
            className="rounded-xl bg-bg px-3 py-2 text-base text-ink"
            value={water}
            onChange={(e) => setWater(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Proteína (g)
          <input
            inputMode="decimal"
            className="rounded-xl bg-bg px-3 py-2 text-base text-ink"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Carbohidratos (g)
          <input
            inputMode="decimal"
            className="rounded-xl bg-bg px-3 py-2 text-base text-ink"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Grasa (g)
          <input
            inputMode="decimal"
            className="rounded-xl bg-bg px-3 py-2 text-base text-ink"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-3 text-sm text-ink">
        <span>
          <b className="block">Mostrar seguimiento de agua</b>
          <span className="text-xs text-muted">Ocultarlo no borra el objetivo ni los registros.</span>
        </span>
        <input
          type="checkbox"
          checked={showWaterTracking}
          onChange={(event) => setShowWaterTracking(event.target.checked)}
          className="h-5 w-5 flex-none accent-sage"
        />
      </label>

      {error && <p className="text-sm text-over">{error}</p>}

      <button
        onClick={handleDelete}
        disabled={deleting || saving}
        className="rounded-2xl border border-over/20 bg-surface py-2.5 font-bold text-over disabled:opacity-50"
      >
        {deleting ? 'Eliminando...' : 'Eliminar persona'}
      </button>

      <div className="flex gap-2">
        <button
          onClick={() => setEditing(false)}
          disabled={deleting}
          className="flex-1 rounded-2xl bg-bg py-2.5 font-bold text-muted"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || deleting}
          className="flex-1 rounded-2xl bg-ink py-2.5 font-bold text-cream disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
