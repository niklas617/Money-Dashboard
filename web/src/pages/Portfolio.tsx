import {
  ArrowRight,
  Bitcoin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AddTradeSheet } from '../components/AddTradeSheet'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { AreaChart } from '../components/AreaChart'
import { CHART_COLORS, Donut } from '../components/Donut'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import {
  Card,
  EmptyState,
  FadeIn,
  Overline,
  PerformancePill,
  SectionHeader,
  Skeleton,
  Spinner,
} from '../components/ui'
import { api, type HistoryPoint, type Holding, type PortfolioSummary, type Trade } from '../lib/api'
import { cn } from '../lib/cn'
import {
  formatEUR,
  formatEURSigned,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatDate,
  parseDecimal,
} from '../lib/format'

export function Portfolio() {
  const toast = useToast()
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTrade, setEditTrade] = useState<Trade | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Trade | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()

  const loadAll = async () => {
    try {
      const [s, t] = await Promise.all([api.portfolioSummary(), api.getTrades()])
      setSummary(s)
      setTrades(t)
    } catch {
      /* leerer Zustand */
    } finally {
      setLoading(false)
    }
    // History separat (kann laenger dauern)
    try {
      const h = await api.portfolioHistory()
      setHistory(h)
    } catch {
      /* egal */
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const holdings = summary?.holdings ?? []

  const removeTrade = async (id: number) => {
    setDeletingId(id)
    try {
      await api.deleteTrade(id)
      toast.success('Trade gelöscht.')
      await loadAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Kopf */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Portfolio</h1>
          <p className="text-[13px] text-text-muted">Aktien &amp; Krypto · Live-Kurse in EUR</p>
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
            <span className="hidden sm:inline">Trade</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-md" />
          ))}
        </div>
      ) : (
        <FadeIn>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Gesamtwert" value={summary?.total_value ?? 0} accent />
            <Kpi label="Investiert" value={summary?.total_invested ?? 0} />
            <Kpi
              label="Unreal. P&L"
              value={summary?.total_unrealized_pnl ?? 0}
              signed
              pct={summary?.total_pnl_pct}
            />
            <Kpi
              label="Real. P&L"
              value={summary?.total_realized_pnl ?? 0}
              signed
              pct={summary?.total_realized_pnl_pct}
            />
          </div>
        </FadeIn>
      )}

      {loading ? (
        <Skeleton className="h-[280px] rounded-lg" />
      ) : holdings.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Noch keine Positionen"
          hint="Füge deinen ersten Trade hinzu – Kurse werden live geladen und deine Wertentwicklung berechnet."
          action={
            <button onClick={() => setSheetOpen(true)} className="btn-primary">
              <Plus size={17} strokeWidth={2.6} /> Ersten Trade erfassen
            </button>
          }
        />
      ) : (
        <>
          {/* Verlauf + Allocation */}
          <FadeIn delay={0.05}>
            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="p-5 lg:col-span-3">
                <Overline>Wertentwicklung</Overline>
                <div className="mt-3">
                  {history.length > 1 ? (
                    <AreaChart data={history} formatValue={formatEUR} height={230} />
                  ) : (
                    <div className="flex h-[230px] items-center justify-center text-center text-[13px] text-text-muted">
                      Verlauf wird nach dem ersten Trade berechnet …
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <Overline>Allocation</Overline>
                <div className="mt-3 flex items-center gap-4">
                  <Donut
                    slices={holdings.map((h) => ({ label: h.symbol, value: h.current_value }))}
                    centerLabel="Assets"
                    centerValue={String(holdings.length)}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {holdings.slice(0, 7).map((h, i) => {
                      const pct =
                        (summary?.total_value ?? 0) > 0
                          ? (h.current_value / (summary?.total_value ?? 1)) * 100
                          : 0
                      return (
                        <div key={h.symbol} className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text-primary">
                            {h.symbol}
                          </span>
                          <span className="tnum text-[12px] font-semibold text-text-secondary">
                            {pct.toFixed(1)} %
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>
            </div>
          </FadeIn>

          {/* Positionen */}
          <FadeIn delay={0.1}>
            <div className="flex flex-col gap-3">
              <SectionHeader title="Positionen" />
              <div className="flex flex-col gap-3">
                {holdings.map((h) => (
                  <HoldingCard key={h.symbol} h={h} />
                ))}
              </div>
            </div>
          </FadeIn>
        </>
      )}

      {/* Trade-Logbuch */}
      {!loading && trades.length > 0 && (
        <FadeIn delay={0.12}>
          <div className="flex flex-col gap-3">
            <SectionHeader title="Trade-Logbuch" trailing={<span className="chip">{trades.length}</span>} />
            <Card className="divide-y divide-border overflow-hidden">
              {[...trades]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((t) => (
                  <TradeRow
                    key={t.id}
                    t={t}
                    onEdit={() => setEditTrade(t)}
                    onDelete={() => setConfirmDelete(t)}
                    deleting={deletingId === t.id}
                  />
                ))}
            </Card>
            <button
              onClick={() => navigate('/portfolio/trades')}
              className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface py-3 text-[13.5px] font-bold text-text-secondary transition-colors hover:border-border-strong hover:text-mint"
            >
              Alle Trades ansehen &amp; filtern (Jahr / Monat)
              <ArrowRight size={16} />
            </button>
          </div>
        </FadeIn>
      )}

      <AddTradeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSaved={loadAll} />
      <EditTradeModal trade={editTrade} onClose={() => setEditTrade(null)} onSaved={loadAll} />

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Trade löschen?">
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-relaxed text-text-secondary">
            {confirmDelete?.symbol} wirklich löschen? Das lässt sich nicht rückgängig machen.
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1 justify-center">
              Abbrechen
            </button>
            <button
              onClick={() => {
                if (confirmDelete) removeTrade(confirmDelete.id)
                setConfirmDelete(null)
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
  const color = accent
    ? 'text-text-primary'
    : signed
      ? isNeg
        ? 'text-negative'
        : 'text-mint'
      : 'text-text-primary'
  return (
    <div
      className={cn(
        'rounded-md border p-4',
        accent ? 'border-mint/30 bg-mint/[0.06]' : 'border-border bg-surface',
      )}
    >
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

function HoldingCard({ h }: { h: Holding }) {
  const isStock = h.asset_type === 'stock'
  const up = h.unrealized_pnl >= 0
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-sm border',
              isStock
                ? 'border-info/25 bg-info/15 text-info'
                : 'border-warning/25 bg-warning/15 text-warning',
            )}
          >
            {isStock ? <TrendingUp size={21} /> : <Bitcoin size={21} />}
          </span>
          <div>
            <div className="text-[15.5px] font-bold text-text-primary">{h.symbol}</div>
            <div className="max-w-[160px] truncate text-[12px] text-text-muted">{h.asset_name}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="tnum text-[15.5px] font-bold text-text-primary">{formatEUR(h.current_value)}</span>
          <PerformancePill text={formatPercent(h.unrealized_pnl_pct)} positive={up} />
        </div>
      </div>

      <div className="mt-3.5 border-t border-border pt-3.5">
        <div className="grid grid-cols-4 gap-2">
          <Metric label="Anzahl" value={formatQuantity(h.quantity)} />
          <Metric label="Ø Buy-In" value={formatPrice(h.avg_buy_in)} />
          <Metric label="Kurs" value={formatPrice(h.current_price)} />
          <Metric
            label="Unreal. P&L"
            value={formatEURSigned(h.unrealized_pnl)}
            color={up ? 'text-mint' : 'text-negative'}
          />
        </div>
      </div>
    </Card>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-text-muted">{label}</div>
      <div className={cn('mt-0.5 truncate tnum text-[12.5px] font-semibold', color ?? 'text-text-secondary')}>
        {value}
      </div>
    </div>
  )
}

export function TradeRow({
  t,
  onEdit,
  onDelete,
  deleting,
}: {
  t: Trade
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const isBuy = t.trade_type === 'BUY'
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-[11px] font-extrabold',
          isBuy ? 'bg-mint/15 text-mint' : 'bg-negative/15 text-negative',
        )}
      >
        {isBuy ? 'K' : 'V'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-text-primary">{t.symbol}</span>
          <span className={cn('text-[11px] font-semibold', isBuy ? 'text-mint' : 'text-negative')}>
            {isBuy ? 'Kauf' : 'Verkauf'}
          </span>
        </div>
        <div className="truncate text-[11.5px] text-text-muted">
          {formatQuantity(t.quantity)} × {formatPrice(t.price_per_unit)} · {formatDate(t.date)}
        </div>
      </div>
      <div className="text-right">
        <div className="tnum text-[13.5px] font-bold text-text-primary">
          {formatEUR(t.quantity * t.price_per_unit)}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-info"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-negative"
        >
          {deleting ? <Spinner size={14} /> : <Trash2 size={15} />}
        </button>
      </div>
    </div>
  )
}

export function EditTradeModal({
  trade,
  onClose,
  onSaved,
}: {
  trade: Trade | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (trade) {
      setTradeType(trade.trade_type === 'SELL' ? 'SELL' : 'BUY')
      setQuantity(String(trade.quantity))
      setPrice(String(trade.price_per_unit))
      setDate(new Date(trade.date).toISOString().slice(0, 10))
    }
  }, [trade])

  const save = async () => {
    if (!trade) return
    const qty = parseDecimal(quantity)
    const pr = parseDecimal(price)
    if (!qty || qty <= 0) return toast.error('Bitte eine gültige Anzahl eingeben.')
    if (pr < 0 || Number.isNaN(pr)) return toast.error('Bitte einen gültigen Preis eingeben.')
    setSaving(true)
    try {
      await api.updateTrade(trade.id, {
        quantity: qty,
        price_per_unit: pr,
        trade_type: tradeType,
        date: `${date}T12:00:00`,
      })
      toast.success('Trade aktualisiert.')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!trade} onClose={onClose} title={trade ? `${trade.symbol} bearbeiten` : ''}>
      {trade && (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-text-muted">{trade.asset_name}</p>

          <div className="grid grid-cols-2 gap-2">
            {(['BUY', 'SELL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTradeType(t)}
                className={cn(
                  'rounded-md border py-3 text-[14px] font-bold transition-all',
                  tradeType === t
                    ? t === 'BUY'
                      ? 'border-mint bg-mint/15 text-mint'
                      : 'border-negative bg-negative/15 text-negative'
                    : 'border-border bg-surface text-text-secondary hover:border-border-strong',
                )}
              >
                {t === 'BUY' ? 'Kauf' : 'Verkauf'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-text-secondary">Anzahl</span>
              <input
                value={quantity}
                inputMode="decimal"
                onChange={(e) => setQuantity(e.target.value)}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-text-secondary">Preis / Stück (€)</span>
              <input
                value={price}
                inputMode="decimal"
                onChange={(e) => setPrice(e.target.value)}
                className="input"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Datum</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input [color-scheme:dark]"
            />
          </label>

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? <Spinner size={18} className="border-on-mint/40 border-t-on-mint" /> : 'Änderungen speichern'}
          </button>
        </div>
      )}
    </Modal>
  )
}
