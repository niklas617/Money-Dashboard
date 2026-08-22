import { ArrowLeft, CandlestickChart, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { Card, EmptyState, FadeIn, SectionHeader, Skeleton } from '../components/ui'
import { api, type Trade } from '../lib/api'
import { cn } from '../lib/cn'
import { formatEUR, MONTHS_DE } from '../lib/format'
import { EditTradeModal, TradeRow } from './Portfolio'

type Dir = 'ALL' | 'BUY' | 'SELL'

export function Trades() {
  const navigate = useNavigate()
  const toast = useToast()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  const [year, setYear] = useState<number | 'ALL'>('ALL')
  const [month, setMonth] = useState<number | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [dir, setDir] = useState<Dir>('ALL')

  const [editTrade, setEditTrade] = useState<Trade | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmDel, setConfirmDel] = useState<Trade | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setTrades(await api.getTrades())
    } catch {
      /* leerer Zustand */
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const years = useMemo(() => {
    const set = new Set<number>()
    trades.forEach((t) => set.add(new Date(t.date).getFullYear()))
    return [...set].sort((a, b) => b - a)
  }, [trades])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...trades]
      .filter((t) => {
        const d = new Date(t.date)
        if (year !== 'ALL' && d.getFullYear() !== year) return false
        if (month !== 'ALL' && d.getMonth() !== month) return false
        if (dir !== 'ALL' && t.trade_type !== dir) return false
        return !q || t.symbol.toLowerCase().includes(q) || t.asset_name.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [trades, year, month, query, dir])

  const total = filtered.reduce((s, t) => s + t.quantity * t.price_per_unit, 0)

  const removeTrade = async (id: number) => {
    setDeletingId(id)
    try {
      await api.deleteTrade(id)
      toast.success('Trade gelöscht.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/portfolio')}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:text-mint"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Alle Trades</h1>
          <p className="text-[13px] text-text-muted">Nach Jahr &amp; Monat filtern</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-2.5">
          <FilterSelect
            value={String(year)}
            onChange={(v) => setYear(v === 'ALL' ? 'ALL' : Number(v))}
            options={[{ v: 'ALL', l: 'Alle Jahre' }, ...years.map((y) => ({ v: String(y), l: String(y) }))]}
          />
          <FilterSelect
            value={String(month)}
            onChange={(v) => setMonth(v === 'ALL' ? 'ALL' : Number(v))}
            options={[{ v: 'ALL', l: 'Alle Monate' }, ...MONTHS_DE.map((m, i) => ({ v: String(i), l: m }))]}
          />
        </div>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Trade suchen (Symbol / Name) …"
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'BUY', 'SELL'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDir(f)}
              className={cn(
                'rounded-pill border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors',
                dir === f
                  ? 'border-mint bg-mint text-on-mint'
                  : 'border-border bg-surface-high text-text-secondary hover:border-border-strong',
              )}
            >
              {f === 'ALL' ? 'Alle' : f === 'BUY' ? 'Käufe' : 'Verkäufe'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[260px] rounded-lg" />
      ) : (
        <FadeIn>
          <div className="flex flex-col gap-3">
            <SectionHeader
              title={`${filtered.length} ${filtered.length === 1 ? 'Trade' : 'Trades'}`}
              trailing={<span className="tnum text-[13px] font-bold text-text-primary">{formatEUR(total)}</span>}
            />
            {filtered.length === 0 ? (
              <EmptyState icon={CandlestickChart} title="Keine Trades" hint="Für diese Filter gibt es keine Trades." />
            ) : (
              <Card className="divide-y divide-border overflow-hidden">
                {filtered.map((t) => (
                  <TradeRow
                    key={t.id}
                    t={t}
                    onEdit={() => setEditTrade(t)}
                    onDelete={() => setConfirmDel(t)}
                    deleting={deletingId === t.id}
                  />
                ))}
              </Card>
            )}
          </div>
        </FadeIn>
      )}

      <EditTradeModal trade={editTrade} onClose={() => setEditTrade(null)} onSaved={load} />

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Trade löschen?">
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-relaxed text-text-secondary">
            {confirmDel?.symbol} wirklich löschen? Das lässt sich nicht rückgängig machen.
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1 justify-center">
              Abbrechen
            </button>
            <button
              onClick={() => {
                if (confirmDel) removeTrade(confirmDel.id)
                setConfirmDel(null)
              }}
              className="flex-1 justify-center rounded-md bg-negative/15 py-3 text-[14px] font-bold text-negative transition-colors hover:bg-negative/25"
            >
              Löschen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; l: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input appearance-none !w-auto min-w-[130px] flex-1 cursor-pointer sm:flex-none"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v} className="bg-surface-elevated">
          {o.l}
        </option>
      ))}
    </select>
  )
}
