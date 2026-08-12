import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

// ---------- Card ----------
export function Card({
  children,
  className,
  gradient,
  onClick,
}: {
  children: ReactNode
  className?: string
  gradient?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-border shadow-card',
        gradient ? 'bg-gradient-hero' : 'bg-surface',
        onClick && 'cursor-pointer transition-colors hover:border-border-strong',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ---------- SectionHeader ----------
export function SectionHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-[18px] w-1 rounded-sm bg-gradient-mint" />
      <h2 className="text-[18px] font-bold tracking-[-0.01em] text-text-primary">{title}</h2>
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  )
}

// ---------- Overline ----------
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('overline', className)}>{children}</span>
}

// ---------- PerformancePill ----------
export function PerformancePill({
  text,
  positive,
  icon = true,
}: {
  text: string
  positive: boolean
  icon?: boolean
}) {
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12.5px] font-bold tnum',
        positive
          ? 'border-mint/30 bg-mint/[0.14] text-mint'
          : 'border-negative/30 bg-negative/[0.14] text-negative',
      )}
    >
      {icon && <Icon size={13} strokeWidth={2.5} />}
      {text}
    </span>
  )
}

// ---------- IconBadge ----------
export function IconBadge({
  icon: Icon,
  color = 'mint',
  size = 44,
}: {
  icon: LucideIcon
  color?: string
  size?: number
}) {
  return (
    <div
      className="flex items-center justify-center rounded-sm border"
      style={{
        width: size,
        height: size,
        backgroundColor: `color-mix(in srgb, ${cssColor(color)} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${cssColor(color)} 22%, transparent)`,
      }}
    >
      <Icon size={size * 0.48} color={cssColor(color)} strokeWidth={2.2} />
    </div>
  )
}

// Named palette -> CSS color (falls Tailwind-Name uebergeben wird)
export function cssColor(name: string): string {
  const map: Record<string, string> = {
    mint: '#35E0A1',
    'mint-bright': '#5CEFC0',
    info: '#63A9FF',
    warning: '#FFC24B',
    violet: '#B79BFF',
    negative: '#FF6B6B',
    positive: '#35E0A1',
  }
  return map[name] ?? name
}

// ---------- Skeleton ----------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md bg-surface-elevated', className)} />
}

// ---------- Spinner ----------
export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border-2 border-mint/25 border-t-mint', className)}
      style={{ width: size, height: size }}
    />
  )
}

// ---------- EmptyState ----------
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface/40 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-surface-high text-text-muted">
        <Icon size={26} />
      </div>
      <p className="text-[15px] font-semibold text-text-primary">{title}</p>
      {hint && <p className="max-w-xs text-[13px] text-text-muted">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

// ---------- Animierter Container fuer Listen/Grids ----------
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
