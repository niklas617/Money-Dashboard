import { ChevronRight, Coins, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AddPhysicalSheet } from '../components/AddPhysicalSheet'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { CHART_COLORS, Donut } from '../components/Donut'
import {
  Card,
  EmptyState,
  FadeIn,
  Overline,
  PerformancePill,
  SectionHeader,
  Skeleton,
} from '../components/ui'
import { api, type PhysicalSummary } from '../lib/api'
import { cn } from '../lib/cn'
import { formatEUR, formatEURSigned, formatGrams, formatPercent } from '../lib/format'

export function Physical() {
  const [summary, setSummary] = useState<PhysicalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const s = await api.physicalSummary()
      setSummary(s)
    } catch {
      /* leerer Zustand */
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const metals = summary?.metals ?? []
  const totalPnl = summary?.total_unrealized_pnl ?? 0
  const up = totalPnl >= 0

  return (
    <div className="flex flex-col gap-7">
      {/* Kopf */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Physische Werte</h1>
          <p className="text-[13px] text-text-muted">Edelmetalle · Live-Kurse in EUR</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            title="Aktualisieren"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:text-mint"
          >
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setSheetOpen(true)} className="btn-primary !px-4 !py-2.5">
            <Plus size={18} strokeWidth={2.6} />
            <span className="hidden sm:inline">Position</span>
          </button>
        </div>
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-md" />
            ))}
          </div>
          <Skeleton className="h-[240px] rounded-lg" />
        </>
      ) : metals.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="Noch keine physischen Werte"
          hint="Erfasse deine erste Position (z. B. Gold oder Silber) – Kurse werden live geladen und dein Gewinn/Verlust berechnet."
          action={
            <button onClick={() => setSheetOpen(true)} className="btn-primary">
              <Plus size={17} strokeWidth={2.6} /> Erste Position erfassen
            </button>
          }
        />
      ) : (
        <>
          {/* KPIs */}
          <FadeIn>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Kpi label="Gesamtwert" value={summary?.total_value ?? 0} accent />
              <Kpi label="Einstand" value={summary?.total_cost ?? 0} />
              <Kpi
                label="Gewinn / Verlust"
                value={totalPnl}
                signed
                pct={summary?.total_unrealized_pnl_pct}
              />
            </div>
          </FadeIn>

          {/* Kuchendiagramm: Verteilung */}
          <FadeIn delay={0.05}>
            <Card className="p-5">
              <Overline>Verteilung</Overline>
              <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                <Donut
                  slices={metals.map((m) => ({ label: m.name, value: m.current_value }))}
                  centerLabel="Wert"
                  centerValue={formatEUR(summary?.total_value ?? 0)}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {metals.map((m, i) => (
                    <div key={m.metal} className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">
                        {m.name}
                      </span>
                      <span className="tnum text-[12.5px] font-semibold text-text-secondary">
                        {formatPercent(m.allocation_pct, false)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </FadeIn>

          {/* Gesamt-G/V-Zeile */}
          <FadeIn delay={0.08}>
            <Card className="flex items-center justify-between p-4">
              <span className="text-[13.5px] font-semibold text-text-secondary">Gesamt-Gewinn / Verlust</span>
              <div className="flex items-center gap-3">
                <span className={cn('tnum text-[16px] font-extrabold', up ? 'text-mint' : 'text-negative')}>
                  {formatEURSigned(totalPnl)}
                </span>
                <PerformancePill text={formatPercent(summary?.total_unrealized_pnl_pct ?? 0)} positive={up} />
              </div>
            </Card>
          </FadeIn>

          {/* Liste je Metall: NUR Name, Menge, G/V */}
          <FadeIn delay={0.1}>
            <div className="flex flex-col gap-3">
              <SectionHeader title="Bestände" />
              <Card className="divide-y divide-border overflow-hidden">
                {metals.map((m, i) => {
                  const pos = m.unrealized_pnl >= 0
                  return (
                    <button
                      key={m.metal}
                      onClick={() => navigate(`/sachwerte/${encodeURIComponent(m.metal)}`)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-elevated"
                    >
                      <span
                        className="h-9 w-9 shrink-0 rounded-sm"
                        style={{ backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}22` }}
                      >
                        <span
                          className="flex h-full w-full items-center justify-center rounded-sm text-[13px] font-extrabold"
                          style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}
                        >
                          {m.name.slice(0, 2)}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold text-text-primary">{m.name}</div>
                        <div className="tnum text-[12px] text-text-muted">{formatGrams(m.gross_grams)}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn('tnum text-[14px] font-bold', pos ? 'text-mint' : 'text-negative')}>
                          {formatEURSigned(m.unrealized_pnl)}
                        </span>
                        <span className={cn('tnum text-[11.5px] font-semibold', pos ? 'text-mint' : 'text-negative')}>
                          {formatPercent(m.unrealized_pnl_pct)}
                        </span>
                      </div>
                      <ChevronRight size={17} className="shrink-0 text-text-muted" />
                    </button>
                  )
                })}
              </Card>
            </div>
          </FadeIn>
        </>
      )}

      <AddPhysicalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSaved={load} />
    </div>
  )
}

function Kpi({
  label,
  value,
  signed,
  pct,
  accent,
}: {
  label: string
  value: number
  signed?: boolean
  pct?: number
  accent?: boolean
}) {
  const isNeg = signed && value < 0
  const color = accent ? 'text-text-primary' : signed ? (isNeg ? 'text-negative' : 'text-mint') : 'text-text-primary'
  return (
    <div className={cn('rounded-md border p-4', accent ? 'border-mint/30 bg-mint/[0.06]' : 'border-border bg-surface')}>
      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      <AnimatedNumber
        value={value}
        format={signed ? formatEURSigned : formatEUR}
        className={cn('mt-1.5 block tnum text-[19px] font-extrabold tracking-tight', color)}
      />
      {pct != null && pct !== 0 && (
        <div className={cn('mt-0.5 tnum text-[12px] font-bold', pct >= 0 ? 'text-mint' : 'text-negative')}>
          {formatPercent(pct)}
        </div>
      )}
    </div>
  )
}
