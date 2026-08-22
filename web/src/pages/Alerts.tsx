import { BellOff, Cloud, Plus, TrendingDown, TrendingUp, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { Card, EmptyState, FadeIn, SectionHeader, Skeleton, Spinner } from '../components/ui'
import { api, type Holding, type PriceAlert } from '../lib/api'
import { cn } from '../lib/cn'
import { formatPrice, parseDecimal } from '../lib/format'

export function Alerts() {
  const toast = useToast()
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<PriceAlert | null>(null)

  const load = async () => {
    try {
      const [al, summary] = await Promise.all([api.getAlerts(), api.portfolioSummary()])
      setAlerts(al)
      setHoldings(summary.holdings ?? [])
    } catch {
      /* egal */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const priceMap = useMemo(() => new Map(holdings.map((h) => [h.symbol, h.current_price])), [holdings])

  const wouldTrigger = (a: PriceAlert) => {
    const p = priceMap.get(a.symbol)
    if (p == null) return false
    return a.above ? p >= a.target_price : p <= a.target_price
  }

  const remove = async (id: number) => {
    try {
      await api.deleteAlert(id)
      toast.success('Alert gelöscht.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Skeleton className="h-[70px] rounded-lg" />
        <Skeleton className="h-[220px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Kurs-Alerts</h1>
          <p className="text-[13px] text-text-muted">Ziele für deine Positionen</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary !px-4 !py-2.5">
          <Plus size={18} strokeWidth={2.6} />
          <span className="hidden sm:inline">Alert</span>
        </button>
      </div>

      {/* Status-Banner (ehrlich: Liste synchron, aber kein Hintergrund-Push) */}
      <FadeIn>
        <div className="flex items-start gap-3 rounded-md border border-info/25 bg-info/[0.06] p-3.5">
          <Cloud size={18} className="mt-0.5 shrink-0 text-info" />
          <p className="text-[12.5px] leading-relaxed text-text-secondary">
            Alerts werden auf dem Server gespeichert und sind in App &amp; Web synchron. Sie werden beim Öffnen
            gegen die Live-Kurse geprüft – Hintergrund-Push ist (noch) nicht aktiv.
          </p>
        </div>
      </FadeIn>

      {alerts.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Noch keine Alerts"
          hint={holdings.length === 0 ? 'Lege zuerst einen Trade an, dann kannst du Kurs-Alerts setzen.' : 'Lege deinen ersten Kurs-Alert an.'}
          action={
            holdings.length > 0 ? (
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus size={17} strokeWidth={2.6} /> Alert erstellen
              </button>
            ) : undefined
          }
        />
      ) : (
        <FadeIn delay={0.05}>
          <div className="flex flex-col gap-3">
            <SectionHeader title="Aktive Alerts" trailing={<span className="chip">{alerts.length}</span>} />
            <div className="flex flex-col gap-3">
              {alerts.map((a) => (
                <AlertTile
                  key={a.id}
                  alert={a}
                  price={priceMap.get(a.symbol)}
                  triggered={wouldTrigger(a)}
                  onDelete={() => setConfirmDelete(a)}
                />
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      <AddAlertModal open={addOpen} onClose={() => setAddOpen(false)} holdings={holdings} onSaved={load} />

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Alert löschen?">
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-relaxed text-text-secondary">
            Alert für {confirmDelete?.symbol} wirklich löschen?
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1 justify-center">
              Abbrechen
            </button>
            <button
              onClick={() => {
                if (confirmDelete) remove(confirmDelete.id)
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

function AlertTile({
  alert,
  price,
  triggered,
  onDelete,
}: {
  alert: PriceAlert
  price?: number
  triggered: boolean
  onDelete: () => void
}) {
  const c = alert.above ? 'text-mint' : 'text-negative'
  const bg = alert.above ? 'bg-mint/15' : 'bg-negative/15'
  return (
    <Card className={cn('p-4', triggered && 'border-mint/50')}>
      <div className="flex items-center gap-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-sm', bg, c)}>
          {alert.above ? <TrendingUp size={21} /> : <TrendingDown size={21} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15.5px] font-bold text-text-primary">{alert.symbol}</span>
            {triggered && (
              <span className="rounded-pill bg-mint/15 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-mint">
                Aktiv
              </span>
            )}
          </div>
          <div className="text-[12.5px] text-text-muted">
            {alert.above ? 'Über' : 'Unter'} {formatPrice(alert.target_price)}
            {price != null ? `  ·  jetzt ${formatPrice(price)}` : ''}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-negative"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Card>
  )
}

function AddAlertModal({
  open,
  onClose,
  holdings,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  holdings: Holding[]
  onSaved: () => void
}) {
  const toast = useToast()
  const [symbol, setSymbol] = useState('')
  const [above, setAbove] = useState(true)
  const [target, setTarget] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && holdings.length > 0) {
      const first = holdings[0]
      setSymbol(first.symbol)
      setTarget(String(first.current_price ?? ''))
      setAbove(true)
    }
  }, [open, holdings])

  const onSymbolChange = (sym: string) => {
    setSymbol(sym)
    const h = holdings.find((x) => x.symbol === sym)
    if (h) setTarget(String(h.current_price ?? ''))
  }

  const save = async () => {
    const h = holdings.find((x) => x.symbol === symbol)
    if (!h) return
    const t = parseDecimal(target)
    if (!t || t <= 0) return toast.error('Bitte einen gültigen Zielkurs eingeben.')
    setSaving(true)
    try {
      await api.createAlert({ symbol: h.symbol, asset_type: h.asset_type, target_price: t, above })
      toast.success('Alert gespeichert.')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Neuer Kurs-Alert">
      {holdings.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-text-muted">
          Keine Positionen vorhanden. Lege zuerst einen Trade an.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Asset</span>
            <select value={symbol} onChange={(e) => onSymbolChange(e.target.value)} className="input appearance-none">
              {holdings.map((h) => (
                <option key={h.symbol} value={h.symbol} className="bg-surface-elevated">
                  {h.symbol} · aktuell {formatPrice(h.current_price)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, label: 'Steigt über', icon: <TrendingUp size={15} /> },
              { v: false, label: 'Fällt unter', icon: <TrendingDown size={15} /> },
            ].map((o) => (
              <button
                key={String(o.v)}
                onClick={() => setAbove(o.v)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md border py-3 text-[13.5px] font-bold transition-all',
                  above === o.v
                    ? o.v
                      ? 'border-mint bg-mint/15 text-mint'
                      : 'border-negative bg-negative/15 text-negative'
                    : 'border-border bg-surface text-text-secondary hover:border-border-strong',
                )}
              >
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Zielkurs (€)</span>
            <input value={target} inputMode="decimal" onChange={(e) => setTarget(e.target.value)} className="input" />
          </label>

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? <Spinner size={18} className="border-on-mint/40 border-t-on-mint" /> : 'Alert erstellen'}
          </button>
        </div>
      )}
    </Modal>
  )
}
