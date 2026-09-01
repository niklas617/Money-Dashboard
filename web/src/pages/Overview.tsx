import { motion } from 'framer-motion'
import { CandlestickChart, RefreshCw, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { AreaChart } from '../components/AreaChart'
import { CashflowCard } from '../components/CashflowCard'
import { Card, FadeIn, Overline, PerformancePill, Skeleton } from '../components/ui'
import { api, type NetWorthPoint } from '../lib/api'
import { formatEUR, formatEURSigned, formatPercent, monthlyCashflow } from '../lib/format'
import { cn } from '../lib/cn'

type Range = { key: string; label: string; days: number | null }
const RANGES: Range[] = [
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '6m', label: '6M', days: 180 },
  { key: '1y', label: '1J', days: 365 },
  { key: 'all', label: 'Max', days: null },
]

export function Overview() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<NetWorthPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rangeKey, setRangeKey] = useState('3m')
  const [cashflow, setCashflow] = useState<{ income: number; expense: number; monthLabel?: string }>({
    income: 0,
    expense: 0,
  })

  const load = async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const data = await api.netWorthHistory()
      setHistory(data)
    } catch {
      /* Fehler still schlucken – leerer Zustand wird angezeigt */
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadCashflow = async () => {
    try {
      const accounts = await api.getAccounts()
      const year = new Date().getFullYear()
      const results = await Promise.all(
        accounts.map((a) => api.getTransactions(a.id, year).catch(() => [])),
      )
      const all = results.flat().map((t) => ({ amount: t.amount, date: t.date }))
      setCashflow(monthlyCashflow(all))
    } catch {
      /* egal */
    }
  }

  useEffect(() => {
    load()
    loadCashflow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = history.length > 0 ? history[history.length - 1].total_value : 0

  const sliced = useMemo(() => {
    const range = RANGES.find((r) => r.key === rangeKey)!
    if (range.days == null) return history
    return history.slice(Math.max(0, history.length - range.days))
  }, [history, rangeKey])

  const rangeChange = useMemo(() => {
    if (sliced.length < 2) return { abs: 0, pct: 0, up: true }
    const start = sliced[0].total_value
    const abs = current - start
    const pct = start !== 0 ? (abs / start) * 100 : 0
    return { abs, pct, up: abs >= 0 }
  }, [sliced, current])

  const todayChange = useMemo(() => {
    if (history.length < 2) return null
    const prev = history[history.length - 2].total_value
    const abs = current - prev
    const pct = prev !== 0 ? (abs / prev) * 100 : 0
    return { abs, pct, up: abs >= 0 }
  }, [history, current])

  return (
    <div className="flex flex-col gap-7">
      {/* --- Kopfzeile --- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Übersicht</h1>
          <p className="text-[13px] text-text-muted">Dein Gesamtvermögen im Blick</p>
        </div>
        <button
          onClick={() => {
            load(true)
            loadCashflow()
          }}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:text-mint"
          title="Aktualisieren"
        >
          <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* --- HERO --- */}
      {loading ? (
        <Skeleton className="h-[360px] w-full rounded-lg" />
      ) : (
        <FadeIn>
          <Card gradient className="overflow-hidden p-6">
            <div className="flex items-center justify-between">
              <Overline>Gesamtvermögen</Overline>
              {todayChange && (
                <PerformancePill
                  text={`${formatPercent(todayChange.pct)} heute`}
                  positive={todayChange.up}
                />
              )}
            </div>

            <div className="mt-3">
              <AnimatedNumber
                value={current}
                format={formatEUR}
                className="tnum text-[40px] font-extrabold leading-none tracking-[-0.03em] text-text-primary sm:text-[46px]"
              />
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              {sliced.length > 1 ? (
                <span
                  className={cn(
                    'tnum text-[13.5px] font-bold',
                    rangeChange.up ? 'text-mint' : 'text-negative',
                  )}
                >
                  {formatEURSigned(rangeChange.abs)} ({formatPercent(rangeChange.pct)})
                </span>
              ) : (
                <span />
              )}
              <RangeSelector value={rangeKey} onChange={setRangeKey} />
            </div>

            <div className="mt-4">
              {sliced.length > 0 ? (
                <AreaChart data={sliced.map((p) => ({ date: p.date, value: p.total_value }))} formatValue={formatEUR} />
              ) : (
                <div className="flex h-[210px] items-center justify-center text-[13px] text-text-muted">
                  Noch keine Daten – füge deinen ersten Trade oder deine erste Buchung hinzu.
                </div>
              )}
            </div>
          </Card>
        </FadeIn>
      )}

      {/* --- Cashflow --- */}
      {loading ? (
        <Skeleton className="h-[150px] w-full rounded-lg" />
      ) : (
        <FadeIn delay={0.05}>
          <CashflowCard income={cashflow.income} expense={cashflow.expense} monthLabel={cashflow.monthLabel} />
        </FadeIn>
      )}

      {/* --- Schnellzugriff --- */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-4">
          <Overline>Schnellzugriff</Overline>
          <div className="grid grid-cols-2 gap-3.5">
            <QuickAction
              icon={<CandlestickChart size={22} />}
              color="#35E0A1"
              title="Trade erfassen"
              hint="Kauf oder Verkauf"
              onClick={() => navigate('/portfolio')}
            />
            <QuickAction
              icon={<Wallet size={22} />}
              color="#63A9FF"
              title="Buchung anlegen"
              hint="Einnahme / Ausgabe"
              onClick={() => navigate('/konten')}
            />
          </div>
        </div>
      </FadeIn>
    </div>
  )
}

function RangeSelector({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-pill border border-border bg-bg-alt/60 p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            'relative rounded-pill px-2.5 py-1 text-[11.5px] font-bold transition-colors',
            value === r.key ? 'text-on-mint' : 'text-text-muted hover:text-text-secondary',
          )}
        >
          {value === r.key && (
            <motion.span
              layoutId="range-active"
              className="absolute inset-0 -z-10 rounded-pill bg-mint"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          {r.label}
        </button>
      ))}
    </div>
  )
}

function QuickAction({
  icon,
  color,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  color: string
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex flex-col items-start gap-3.5 rounded-md border border-border bg-surface p-5 text-left transition-colors hover:border-border-strong"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-sm border"
        style={{
          color,
          backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
          borderColor: `color-mix(in srgb, ${color} 24%, transparent)`,
        }}
      >
        {icon}
      </span>
      <div>
        <div className="text-[14.5px] font-bold text-text-primary">{title}</div>
        <div className="text-[11.5px] text-text-muted">{hint}</div>
      </div>
    </motion.button>
  )
}
