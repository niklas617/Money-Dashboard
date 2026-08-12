import { ChevronRight, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TOOLS } from '../components/AppShell'
import { Card, FadeIn } from '../components/ui'
import { useAuth } from '../lib/auth'

export function More() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const items = [...TOOLS, { to: '/einstellungen', label: 'Einstellungen', icon: SettingsIcon }]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Mehr</h1>
        <p className="text-[13px] text-text-muted">Werkzeuge &amp; Einstellungen</p>
      </div>

      <FadeIn>
        <Card className="divide-y divide-border overflow-hidden">
          {items.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-surface-elevated"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-surface-high text-mint">
                <Icon size={19} />
              </span>
              <span className="flex-1 text-[15px] font-semibold text-text-primary">{label}</span>
              <ChevronRight size={18} className="text-text-muted" />
            </button>
          ))}
        </Card>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-high text-[13px] font-bold text-mint">
              {(user ?? '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-text-primary">{user}</div>
              <div className="text-[11.5px] text-text-muted">Angemeldet</div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-sm border border-negative/30 bg-negative/10 px-3 py-2 text-[13px] font-bold text-negative"
            >
              <LogOut size={15} /> Abmelden
            </button>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
