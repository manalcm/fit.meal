/** Aclara (percent > 0) u oscurece (percent < 0) un color hex por un porcentaje de 0 a 1. */
export function shade(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amount = Math.round(255 * percent)
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/** Degradado de tarjeta a partir del color de una persona, en el mismo estilo que las heroGradient del diseño. */
export function heroGradient(color: string): string {
  return `linear-gradient(155deg, ${shade(color, 0.16)}, ${shade(color, -0.22)})`
}
