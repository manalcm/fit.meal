import { NavLink } from 'react-router-dom'
import {
  HoyIcon,
  SemanaIcon,
  PlatosIcon,
  IngredientesIcon,
  CompraIcon,
  AjustesIcon,
} from './NavIcons'

const TABS = [
  { to: '/', label: 'Hoy', Icon: HoyIcon },
  { to: '/semana', label: 'Semana', Icon: SemanaIcon },
  { to: '/biblioteca', label: 'Platos', Icon: PlatosIcon },
  { to: '/ingredientes', label: 'Ingr.', Icon: IngredientesIcon },
  { to: '/compra', label: 'Compra', Icon: CompraIcon },
  { to: '/ajustes', label: 'Ajustes', Icon: AjustesIcon },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md gap-1 rounded-[22px] bg-surface p-1.5 shadow-[0_16px_34px_-12px_rgba(35,48,31,0.3)]">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[9px] font-bold transition-all active:scale-95 ${
              isActive ? 'bg-ink text-cream' : 'text-muted'
            }`
          }
        >
          <Icon />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
