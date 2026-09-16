import { ArrowLeft, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AddPhysicalSheet, type PhysicalEditTarget } from '../components/AddPhysicalSheet'
import { AreaChart } from '../components/AreaChart'
import { Modal } from '../components/Modal'
import { RangeSelector, type Range } from '../components/RangeSelector'
import { Card, EmptyState, FadeIn, Overline, PerformancePill, SectionHeader, Skeleton, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { api, type MetalHolding, type PhysicalPosition, type PhysicalPricePoint } from '../lib/api'
import { cn } from '../lib/cn'
import {
  formatDate,
  formatDateTime,
  formatEUR,
  formatEURSigned,
  formatGrams,
  formatHoldingDuration,
  formatPercent,
  formatPricePerGram,
} from '../lib/format'

export function PhysicalDetail() {
  const { metal = '' } = useParams()
  const metalKey = decodeURIComponent(metal).toUpperCase()
  const navigate = useNavigate()
  const toast = useToast()

  const [holding, setHolding] = useState<MetalHolding | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('1J')
  const [history, setHistory] = useState<PhysicalPricePoint[]>([])
  const [histLoading, setHistLoading] = useState(true)
  const [editPos, setEditPos] = useState<PhysicalEditTarget | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState<PhysicalPosition | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadSummary = useCallback(async () => {
    try {
      const s = await api.physicalSummary()
      const h = s.metals.find((m) => m.metal === metalKey) ?? null
      setHolding(h)
    } catch {
      setHolding(null)
    } finally {
      setLoading(false)
    }
  }, [metalKey])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const h = await api.physicalPriceHistory(metalKey, range)
      setHistory(h)
    } catch {
      setHistory([])
    } finally {
      setHistLoading(false)
    }
  }, [metalKey, range])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const del = async (id: number) => {
    setDeleting(true)
    try {
      await api.deletePhysicalAsset(id)
      toast.success('Position gelöscht.')
      await loadSummary()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    } finally {
      setDeleting(false)
      setConfirmDel(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-[260px] rounded-lg" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    )
  }

  if (!holding) {
    return (
      <div className="flex flex-col gap-6">
        <BackHeader title={metalKey} onBack={() => navigate('/sachwerte')} />
        <EmptyState icon={MapPin} title="Position nicht gefunden" hint="Diese Position gibt es nicht (mehr)." />
      </div>
    )
  }

  const up = holding.unrealized_pnl >= 0
  const finenessValues = Array.from(new Set(holding.positions.map((p) => p.fineness)))
  const finenessLabel = finenessValues.length === 1 ? `${finenessValues[0]} ‰` : 'gemischt'
  const chartHasData = history.length > 1

  return (
    <div className="flex flex-col gap-7">
      <BackHeader title={holding.name} onBack={() => navigate('/sachwerte')} />

      {/* Wert + G/V */}
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">Aktueller Wert</div>
            <div className="tnum text-[30px] font-extrabold tracking-tight text-text-primary">
              {formatEUR(holding.current_value)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn('tnum text-[16px] font-bold', up ? 'text-mint' : 'text-negative')}>
              {formatEURSigned(holding.unrealized_pnl)}
            </span>
            <PerformancePill text={formatPercent(holding.unrealized_pnl_pct)} positive={up} />
          </div>
        </div>
      </FadeIn>

      {/* Kursverlauf */}
      <FadeIn delay={0.05}>
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Overline>Kursverlauf · €/g</Overline>
            <RangeSelector value={range} onChange={setRange} />
          </div>
          <div className="mt-3">
            {histLoading ? (
              <div className="flex h-[230px] items-center justify-center">
                <Spinner />
              </div>
            ) : chartHasData ? (
              <AreaChart
                data={history}
                formatValue={formatPricePerGram}
                height={230}
                refLine={
                  holding.avg_cost_per_fine_gram > 0
                    ? { value: holding.avg_cost_per_fine_gram, label: 'Ø Einstand' }
                    : undefined
                }
              />
            ) : (
              <div className="flex h-[230px] items-center justify-center text-center text-[13px] text-text-muted">
                {holding.has_market_price
                  ? 'Für diesen Zeitraum liegt kein Kursverlauf vor.'
                  : 'Für dieses Metall gibt es keinen Live-Kursverlauf.'}
              </div>
            )}
          </div>
        </Card>
      </FadeIn>

      {/* Auswertung */}
      <FadeIn delay={0.08}>
        <Card className="p-5">
          <Overline>Auswertung</Overline>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            <Field label="Menge" value={formatGrams(holding.gross_grams)} />
            <Field label="Feinmenge" value={formatGrams(holding.fine_grams)} />
            <Field label="Feingehalt" value={finenessLabel} />
            <Field
              label="Kurs (€/g)"
              value={formatPricePerGram(holding.price_per_gram)}
              hint={
                holding.has_market_price
                  ? `Stand: ${formatDateTime(holding.price_timestamp)}${holding.price_stale ? ' · verzögert' : ''}`
                  : 'kein Live-Kurs'
              }
              hintWarn={holding.price_stale || !holding.has_market_price}
            />
            <Field label="Kurs (€/oz)" value={formatEUR(holding.price_per_ounce)} />
            <Field label="Gesamtwert" value={formatEUR(holding.current_value)} />
            <Field label="Ø Einstand (€/g)" value={formatPricePerGram(holding.avg_cost_per_fine_gram)} />
            <Field label="Einstand gesamt" value={formatEUR(holding.total_cost)} />
            <Field
              label="Gewinn / Verlust"
              value={formatEURSigned(holding.unrealized_pnl)}
              valueColor={up ? 'text-mint' : 'text-negative'}
              hint={formatPercent(holding.unrealized_pnl_pct)}
              hintColor={up ? 'text-mint' : 'text-negative'}
            />
            <Field label="Haltedauer" value={formatHoldingDuration(holding.earliest_purchase_date)} />
          </div>
        </Card>
      </FadeIn>

      {/* Positionen (Einzelkäufe) */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-3">
          <SectionHeader
            title="Positionen"
            trailing={
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] font-bold text-text-secondary transition-colors hover:border-border-strong hover:text-mint"
              >
                <Plus size={15} /> Kauf
              </button>
            }
          />
          <div className="flex flex-col gap-3">
            {holding.positions.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="tnum text-[15px] font-bold text-text-primary">
                      {formatGrams(p.gross_grams)} · {p.fineness} ‰
                    </div>
                    <div className="text-[12px] text-text-muted">
                      Kauf am {formatDate(p.purchase_date)} · {formatEUR(p.purchase_price_eur)}
                    </div>
                    {p.storage_location && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-sm bg-surface-high px-2 py-1 text-[11.5px] text-text-secondary">
                        <MapPin size={12} /> {p.storage_location}
                      </div>
                    )}
                    {p.note && <div className="mt-1 text-[11.5px] italic text-text-muted">{p.note}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() =>
                        setEditPos({
                          id: p.id,
                          metal: holding.metal,
                          name: holding.name,
                          quantity: p.quantity,
                          unit: p.unit,
                          fineness: p.fineness,
                          purchase_price_eur: p.purchase_price_eur,
                          purchase_date: p.purchase_date,
                          storage_location: p.storage_location,
                          note: p.note,
                        })
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-info"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDel(p)}
                      className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-negative"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Sheets / Modals */}
      <AddPhysicalSheet open={addOpen} onClose={() => setAddOpen(false)} onSaved={loadSummary} />
      <AddPhysicalSheet open={!!editPos} onClose={() => setEditPos(null)} onSaved={loadSummary} edit={editPos} />

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Position löschen?">
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-relaxed text-text-secondary">
            Diese Position wirklich löschen? Das lässt sich nicht rückgängig machen.
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1 justify-center">
              Abbrechen
            </button>
            <button
              onClick={() => confirmDel && del(confirmDel.id)}
              disabled={deleting}
              className="flex-1 justify-center rounded-md bg-negative/15 py-3 text-[14px] font-bold text-negative transition-colors hover:bg-negative/25"
            >
              {deleting ? <Spinner size={16} /> : 'Löschen'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={18} />
      </button>
      <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">{title}</h1>
    </div>
  )
}

function Field({
  label,
  value,
  hint,
  hintColor,
  hintWarn,
  valueColor,
}: {
  label: string
  value: string
  hint?: string
  hintColor?: string
  hintWarn?: boolean
  valueColor?: string
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</div>
      <div className={cn('mt-0.5 truncate tnum text-[14px] font-bold', valueColor ?? 'text-text-primary')}>{value}</div>
      {hint && (
        <div className={cn('mt-0.5 truncate text-[11px] font-semibold', hintColor ?? (hintWarn ? 'text-warning' : 'text-text-muted'))}>
          {hint}
        </div>
      )}
    </div>
  )
}
