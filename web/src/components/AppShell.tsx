import { motion } from 'framer-motion'
import {
  Bell,
  Download,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  LogOut,
  PiggyBank,
  Settings as SettingsIcon,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/cn'
import { MonetraMark } from './MonetraMark'
import type { ReactNode } from 'react'

type NavItem = { to: string; label: string; icon: LucideIcon }

const PRIMARY: NavItem[] = [
  { to: '/', label: 'Übersicht', icon: LayoutDashboard },
  { to: '/portfolio', label: 'Portfolio', icon: LineChart },
  { to: '/konten', label: 'Konten', icon: Wallet },
]

// Werkzeuge (Sidebar-Sektion / „Mehr"-Hub auf Mobile)
export const TOOLS: NavItem[] = [
  { to: '/budgets', label: 'Sparziele & Budgets', icon: PiggyBank },
  { to: '/alerts', label: 'Kurs-Alerts', icon: Bell },
  { to: '/export', label: 'Export', icon: Download },
]

const SETTINGS: NavItem = { to: '/einstellungen', label: 'Einstellungen', icon: SettingsIcon }

// Mobile-Bottom-Nav: 3 Haupt + „Mehr"
const BOTTOM: NavItem[] = [...PRIMARY, { to: '/mehr', label: 'Mehr', icon: LayoutGrid }]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="overflow-hidden rounded-[9px] shadow-glow">
        <MonetraMark size={36} className="block" />
      </div>
      <div className="text-[16px] font-extrabold tracking-tight text-text-primary">Monetra</div>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const initials = (user ?? '?').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-full lg:flex">
      {/* --- Desktop-Sidebar --- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-bg-alt px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>

        <nav className="mt-9 flex flex-1 flex-col gap-1.5">
          {PRIMARY.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}

          <div className="px-3 pb-2 pt-5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Werkzeuge
          </div>
          {TOOLS.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}

          <div className="mt-auto" />
          <SidebarLink item={SETTINGS} />
        </nav>

        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-high text-[13px] font-bold text-mint">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-text-primary">{user}</div>
              <div className="text-[11px] text-text-muted">Angemeldet</div>
            </div>
            <button
              onClick={logout}
              title="Abmelden"
              className="rounded-sm p-2 text-text-muted transition-colors hover:bg-surface-high hover:text-negative"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* --- Hauptbereich --- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/85 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Logo />
          <button
            onClick={logout}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-high text-text-secondary"
          >
            <LogOut size={17} />
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-bg-alt/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          {BOTTOM.map((item) => (
            <BottomLink key={item.to} item={item} />
          ))}
        </nav>
      </div>
    </div>
  )
}

function SidebarLink({ item }: { item: NavItem }) {
  const { icon: Icon, label, to } = item
  return (
    <NavLink to={to} end={to === '/'}>
      {({ isActive }) => (
        <div
          className={cn(
            'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[14.5px] font-semibold transition-colors',
            isActive ? 'bg-mint/[0.10] text-mint' : 'text-text-secondary hover:bg-surface hover:text-text-primary',
          )}
        >
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-mint"
            />
          )}
          <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
          {label}
        </div>
      )}
    </NavLink>
  )
}

function BottomLink({ item }: { item: NavItem }) {
  const { icon: Icon, label, to } = item
  // „Mehr" auch für /budgets, /einstellungen als aktiv markieren
  const location = useLocation()
  const extraActive =
    to === '/mehr' && ['/budgets', '/alerts', '/export', '/einstellungen', '/mehr'].includes(location.pathname)
  return (
    <NavLink to={to} end={to === '/'} className="flex flex-1 flex-col items-center gap-1 py-2.5">
      {({ isActive }) => {
        const on = isActive || extraActive
        return (
          <>
            <Icon size={21} strokeWidth={on ? 2.6 : 2} className={on ? 'text-mint' : 'text-text-muted'} />
            <span className={cn('text-[10.5px] font-semibold', on ? 'text-mint' : 'text-text-muted')}>{label}</span>
          </>
        )
      }}
    </NavLink>
  )
}
