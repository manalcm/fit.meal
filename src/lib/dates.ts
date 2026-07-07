const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

// Semana empieza en lunes.
export function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(d, diff)
}

export function dayLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`
}

export function rangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth()
  const startStr = `${start.getDate()}${sameMonth ? '' : ' de ' + MONTH_NAMES[start.getMonth()]}`
  const endStr = `${end.getDate()} de ${MONTH_NAMES[end.getMonth()]}`
  return `${startStr} al ${endStr}`
}

export function isSameDate(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

/** Rejilla de semanas (lunes-domingo) que cubren el mes de `d`, con días de meses vecinos para rellenar. */
export function monthGrid(d: Date): Date[][] {
  const firstDay = startOfMonth(d)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const gridStart = startOfWeek(firstDay)
  const gridEnd = addDays(startOfWeek(lastDay), 6)

  const weeks: Date[][] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i))
    weeks.push(week)
    cursor = addDays(cursor, 7)
  }
  return weeks
}
