const common = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function HoyIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  )
}

export function SemanaIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  )
}

export function PlatosIcon() {
  return (
    <svg {...common}>
      <path d="M3 12h18" />
      <path d="M4 12a8 6 0 0 0 16 0" />
      <path d="M12 3v3" />
    </svg>
  )
}

export function IngredientesIcon() {
  return (
    <svg {...common}>
      <path d="M5 21c0-9 5-16 14-16 0 9-5 16-14 16z" />
      <path d="M6 20c3-4 6-7 12-13" />
    </svg>
  )
}

export function CompraIcon() {
  return (
    <svg {...common}>
      <path d="M6 8h12l1 12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

export function AjustesIcon() {
  return (
    <svg {...common}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  )
}
