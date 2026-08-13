import { Bitcoin, Check, Loader2, Search, TrendingUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, type LookupResult, type SearchResult } from '../lib/api'
import { formatPrice, parseDecimal } from '../lib/format'
import { cn } from '../lib/cn'
import { Modal } from './Modal'
import { Spinner } from './ui'
import { useToast } from './Toast'

type Step = 'search' | 'form'

export function AddTradeSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [step, setStep] = useState<Step>('search')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [lookup, setLookup] = useState<LookupResult | null>(null)
  const [loadingLookup, setLoadingLookup] = useState(false)

  // Formular
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      // Reset bei Schliessen
      setStep('search')
      setQuery('')
      setResults([])
      setLookup(null)
      setQuantity('')
      setPrice('')
      setTradeType('BUY')
      setTradeDate(new Date().toISOString().slice(0, 10))
    }
  }, [open])

  // Debounced Suche
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const controller = new AbortController()
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await api.searchAsset(query.trim(), controller.signal)
        setResults(res)
      } catch {
        /* abort/fehler ignorieren */
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => {
      controller.abort()
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  const pick = async (r: SearchResult) => {
    setLoadingLookup(true)
    try {
      const data = await api.lookupAsset(r.symbol, r.asset_type, r.coin_id)
      // coin_id absichern: bevorzugt vom Backend, sonst aus dem Suchergebnis
      setLookup({ ...data, coin_id: data.coin_id ?? r.coin_id ?? null })
      setPrice(String(data.price_eur || data.current_price || ''))
      setStep('form')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kurs konnte nicht geladen werden.')
    } finally {
      setLoadingLookup(false)
    }
  }

  const save = async () => {
    if (!lookup) return
    const qty = parseDecimal(quantity)
    const pr = parseDecimal(price)
    if (!qty || qty <= 0) return toast.error('Bitte eine gültige Anzahl eingeben.')
    if (pr < 0 || Number.isNaN(pr)) return toast.error('Bitte einen gültigen Preis eingeben.')

    setSaving(true)
    try {
      await api.createTrade({
        symbol: lookup.symbol,
        asset_name: lookup.name,
        asset_type: lookup.asset_type,
        trade_type: tradeType,
        quantity: qty,
        price_per_unit: pr,
        coin_id: lookup.coin_id ?? null,
        date: `${tradeDate}T12:00:00`,
      })
      toast.success(`${tradeType === 'BUY' ? 'Kauf' : 'Verkauf'} von ${lookup.symbol} gespeichert!`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const total = (() => {
    const qty = parseDecimal(quantity)
    const pr = parseDecimal(price)
    if (!qty || Number.isNaN(pr)) return 0
    return qty * pr
  })()

  return (
    <Modal open={open} onClose={onClose} title="Trade erfassen">
      {step === 'search' && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Apple, Nvidia, Bitcoin, Ethereum …"
              className="input pl-11"
            />
            {searching && <Spinner size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2" />}
          </div>

          <div className="flex flex-col gap-1.5">
            {results.length === 0 && query.trim().length >= 2 && !searching && (
              <p className="py-6 text-center text-[13px] text-text-muted">Keine Treffer – Schreibweise prüfen.</p>
            )}
            {query.trim().length < 2 && (
              <p className="py-6 text-center text-[13px] text-text-muted">
                Tippe mindestens 2 Zeichen, um Aktien &amp; Krypto zu suchen.
              </p>
            )}
            {results.map((r, i) => (
              <button
                key={`${r.symbol}-${i}`}
                onClick={() => pick(r)}
                disabled={loadingLookup}
                className="flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-elevated disabled:opacity-50"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm',
                    r.asset_type === 'stock' ? 'bg-info/15 text-info' : 'bg-warning/15 text-warning',
                  )}
                >
                  {r.asset_type === 'stock' ? <TrendingUp size={17} /> : <Bitcoin size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-text-primary">{r.name}</div>
                  <div className="text-[11.5px] text-text-muted">
                    {r.symbol} · {r.asset_type === 'stock' ? 'Aktie' : 'Krypto'}
                    {r.exchange ? ` · ${r.exchange}` : ''}
                  </div>
                </div>
                {loadingLookup && <Loader2 size={16} className="animate-spin text-text-muted" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'form' && lookup && (
        <div className="flex flex-col gap-4">
          {/* Asset-Kopf */}
          <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3.5">
            {lookup.logo_url ? (
              <img src={lookup.logo_url} alt="" className="h-11 w-11 rounded-sm object-contain" />
            ) : (
              <span
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-sm',
                  lookup.asset_type === 'stock' ? 'bg-info/15 text-info' : 'bg-warning/15 text-warning',
                )}
              >
                {lookup.asset_type === 'stock' ? <TrendingUp size={20} /> : <Bitcoin size={20} />}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-text-primary">{lookup.name}</div>
              <div className="text-[12px] text-text-muted">
                {lookup.symbol} · Kurs {formatPrice(lookup.price_eur || lookup.current_price)}
              </div>
            </div>
            <button
              onClick={() => {
                setStep('search')
                setLookup(null)
              }}
              className="chip shrink-0"
            >
              Ändern
            </button>
          </div>

          {/* BUY / SELL */}
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
            <LabeledInput
              label="Anzahl"
              value={quantity}
              onChange={setQuantity}
              placeholder="0,00"
              inputMode="decimal"
              autoFocus
            />
            <LabeledInput
              label="Preis / Stück (€)"
              value={price}
              onChange={setPrice}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>

          <LabeledInput label="Datum" value={tradeDate} onChange={setTradeDate} type="date" />

          <div className="flex items-center justify-between rounded-md border border-border bg-surface-elevated/60 px-4 py-3">
            <span className="text-[13px] font-medium text-text-secondary">Gesamtwert</span>
            <span className="tnum text-[16px] font-extrabold text-text-primary">{formatPrice(total)}</span>
          </div>

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? (
              <Spinner size={18} className="border-on-mint/40 border-t-on-mint" />
            ) : (
              <>
                <Check size={18} strokeWidth={2.6} /> Trade speichern
              </>
            )}
          </button>
        </div>
      )}
    </Modal>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputMode?: 'decimal' | 'text' | 'numeric'
  autoFocus?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-text-secondary">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input [color-scheme:dark]"
      />
    </label>
  )
}
