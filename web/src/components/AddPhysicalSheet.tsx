import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, type MetalOption, type PhysicalAssetInput, type PhysicalTemplate } from '../lib/api'
import { cn } from '../lib/cn'
import { formatEUR, parseAmount, parseDecimal } from '../lib/format'

// Zahl -> deutsche Eingabe-Zeichenkette (Komma), ohne unnötige Nullen.
const deInput = (n: number) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6, useGrouping: false }).format(n)
import { Modal } from './Modal'
import { Spinner } from './ui'
import { useToast } from './Toast'

export type PhysicalEditTarget = {
  id: number
  metal: string
  name: string
  quantity: number
  unit: string
  fineness: number
  purchase_price_eur: number
  purchase_date: string | null
  storage_location: string | null
  note: string | null
}

const UNITS: { value: string; label: string }[] = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'oz', label: 'oz' },
]
const FINENESS_PRESETS = [999.9, 999, 925, 585]
const CUSTOM = '__custom__'
const fineLabel = (f: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(f)

export function AddPhysicalSheet({
  open,
  onClose,
  onSaved,
  edit,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  edit?: PhysicalEditTarget | null
}) {
  const toast = useToast()
  const [metals, setMetals] = useState<MetalOption[]>([])
  const [templates, setTemplates] = useState<PhysicalTemplate[]>([])

  const [metalSel, setMetalSel] = useState<string>('XAU')
  const [customName, setCustomName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('g')
  const [fineness, setFineness] = useState('999')
  const [priceMode, setPriceMode] = useState<'total' | 'per_unit'>('total')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [storage, setStorage] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Metall-Liste + Vorlagen laden
  useEffect(() => {
    if (!open) return
    api.getMetals().then(setMetals).catch(() => setMetals([]))
    api.getPhysicalTemplates().then(setTemplates).catch(() => setTemplates([]))
  }, [open])

  // Vorlage anwenden: Metall, Einheit, Menge und Feingehalt vorbefüllen (danach frei änderbar)
  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    const known = ['XAU', 'XAG', 'XPT', 'XPD', 'XCU'].includes(t.metal)
    setMetalSel(known ? t.metal : CUSTOM)
    if (!known) setCustomName(t.metal)
    setUnit(t.unit)
    setQuantity(deInput(t.quantity))
    setFineness(deInput(t.fineness))
  }

  // Formular initialisieren (neu vs. bearbeiten)
  useEffect(() => {
    if (!open) return
    if (edit) {
      const known = ['XAU', 'XAG', 'XPT', 'XPD', 'XCU'].includes(edit.metal)
      setMetalSel(known ? edit.metal : CUSTOM)
      setCustomName(known ? '' : edit.name || edit.metal)
      setQuantity(deInput(edit.quantity))
      setUnit(edit.unit)
      setFineness(deInput(edit.fineness))
      setPriceMode('total')
      setPrice(String(edit.purchase_price_eur))
      setDate((edit.purchase_date || new Date().toISOString()).slice(0, 10))
      setStorage(edit.storage_location || '')
      setNote(edit.note || '')
    } else {
      setMetalSel('XAU')
      setCustomName('')
      setQuantity('')
      setUnit('g')
      setFineness('999')
      setPriceMode('total')
      setPrice('')
      setDate(new Date().toISOString().slice(0, 10))
      setStorage('')
      setNote('')
    }
  }, [open, edit])

  const isCustom = metalSel === CUSTOM

  // Vorschau Gesamt-Kaufpreis (bei „pro Einheit")
  const totalPreview = (() => {
    const qty = parseDecimal(quantity)
    const pr = parseAmount(price)
    if (!qty || Number.isNaN(pr)) return null
    return priceMode === 'per_unit' ? qty * pr : pr
  })()

  const save = async () => {
    const metal = (isCustom ? customName : metalSel).toUpperCase().trim()
    const name = isCustom
      ? customName.trim()
      : metals.find((m) => m.symbol === metalSel)?.name || metalSel
    const qty = parseDecimal(quantity)
    const fine = parseDecimal(fineness)
    const priceVal = parseAmount(price)

    if (isCustom && !customName.trim()) return toast.error('Bitte einen Namen für das Metall eingeben.')
    if (!qty || qty <= 0) return toast.error('Bitte eine gültige Menge (> 0) eingeben.')
    if (!fine || fine <= 0 || fine > 1000) return toast.error('Feingehalt muss zwischen 1 und 1000 liegen (z. B. 999,9).')
    if (Number.isNaN(priceVal) || priceVal < 0) return toast.error('Bitte einen gültigen Kaufpreis eingeben.')
    if (date && date > new Date().toISOString().slice(0, 10))
      return toast.error('Das Kaufdatum darf nicht in der Zukunft liegen.')

    const totalEur = priceMode === 'per_unit' ? qty * priceVal : priceVal

    const payload: PhysicalAssetInput = {
      metal,
      name: name || metal,
      quantity: qty,
      unit,
      fineness: fine,
      purchase_price_eur: totalEur,
      purchase_date: `${date}T12:00:00`,
      storage_location: storage.trim() || null,
      note: note.trim() || null,
    }

    setSaving(true)
    try {
      if (edit) {
        await api.updatePhysicalAsset(edit.id, payload)
        toast.success('Position aktualisiert.')
      } else {
        await api.createPhysicalAsset(payload)
        toast.success(`${name || metal} gespeichert.`)
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={edit ? 'Position bearbeiten' : 'Physische Position erfassen'}>
      <div className="flex flex-col gap-4">
        {/* Vorlage (optional) – füllt Metall, Einheit, Menge, Feingehalt vor */}
        {!edit && templates.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">
              Vorlage <span className="font-normal text-text-muted">(optional)</span>
            </span>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) applyTemplate(e.target.value)
              }}
              className="input [color-scheme:dark]"
            >
              <option value="">Münze / Barren wählen …</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Metall */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-text-secondary">Metall</span>
          <select
            value={metalSel}
            onChange={(e) => setMetalSel(e.target.value)}
            className="input [color-scheme:dark]"
          >
            {metals.map((m) => (
              <option key={m.symbol} value={m.symbol}>
                {m.name}
              </option>
            ))}
            <option value={CUSTOM}>Eigenes Metall …</option>
          </select>
        </label>

        {isCustom && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Name des Metalls</span>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="z. B. Rhodium"
              className="input"
              autoFocus
            />
            <span className="text-[11px] text-text-muted">Ohne Live-Kurs – Wert entspricht dem Kaufpreis.</span>
          </label>
        )}

        {/* Menge + Einheit */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Menge</span>
            <input
              value={quantity}
              inputMode="decimal"
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0,00"
              className="input [color-scheme:dark]"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Einheit</span>
            <div className="grid grid-cols-3 gap-1.5">
              {UNITS.map((u) => (
                <button
                  key={u.value}
                  onClick={() => setUnit(u.value)}
                  className={cn(
                    'rounded-md border py-2.5 text-[13px] font-bold transition-colors',
                    unit === u.value
                      ? 'border-mint bg-mint/15 text-mint'
                      : 'border-border bg-surface text-text-secondary hover:border-border-strong',
                  )}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feingehalt */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-text-secondary">Feingehalt (‰)</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {FINENESS_PRESETS.map((f) => (
              <button
                key={f}
                onClick={() => setFineness(deInput(f))}
                className={cn(
                  'rounded-md border px-3 py-2.5 text-[13px] font-bold transition-colors',
                  fineness === deInput(f)
                    ? 'border-mint bg-mint/15 text-mint'
                    : 'border-border bg-surface text-text-secondary hover:border-border-strong',
                )}
              >
                {fineLabel(f)}
              </button>
            ))}
            <input
              value={fineness}
              inputMode="decimal"
              onChange={(e) => setFineness(e.target.value.replace(/[^\d.,]/g, ''))}
              className="input [color-scheme:dark] max-w-[90px]"
              placeholder="999,9"
            />
          </div>
        </div>

        {/* Kaufpreis + Modus */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-text-secondary">Kaufpreis</span>
            <div className="inline-flex rounded-pill border border-border bg-surface-high p-0.5">
              {(['total', 'per_unit'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPriceMode(m)}
                  className={cn(
                    'rounded-pill px-2.5 py-1 text-[11px] font-bold transition-colors',
                    priceMode === m ? 'bg-mint text-on-mint' : 'text-text-secondary',
                  )}
                >
                  {m === 'total' ? 'Gesamt' : 'pro Einheit'}
                </button>
              ))}
            </div>
          </div>
          <input
            value={price}
            inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
            placeholder={priceMode === 'total' ? 'Gesamtpreis in €' : `€ pro ${unit}`}
            className="input [color-scheme:dark]"
          />
          {priceMode === 'per_unit' && totalPreview != null && (
            <span className="text-[11px] text-text-muted">Gesamt: {formatEUR(totalPreview)}</span>
          )}
        </div>

        {/* Kaufdatum */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-text-secondary">Kaufdatum</span>
          <input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="input [color-scheme:dark]"
          />
        </label>

        {/* Lagerort (optional) */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-text-secondary">
            Lagerort <span className="font-normal text-text-muted">(optional)</span>
          </span>
          <input
            value={storage}
            onChange={(e) => setStorage(e.target.value)}
            placeholder="z. B. Bankschließfach, Zuhause …"
            className="input"
          />
        </label>

        {/* Notiz (optional) */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-text-secondary">
            Notiz <span className="font-normal text-text-muted">(optional)</span>
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z. B. Krügerrand, Händler …"
            className="input"
          />
        </label>

        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? (
            <Spinner size={18} className="border-on-mint/40 border-t-on-mint" />
          ) : (
            <>
              <Check size={18} strokeWidth={2.6} /> {edit ? 'Änderungen speichern' : 'Position speichern'}
            </>
          )}
        </button>
      </div>
    </Modal>
  )
}
