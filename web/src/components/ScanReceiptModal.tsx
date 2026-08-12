import { ImagePlus, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { Modal } from './Modal'
import { Spinner } from './ui'
import { useToast } from './Toast'

export function ScanReceiptModal({
  open,
  onClose,
  accountId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  accountId: number
  onSaved: () => void
}) {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setScanning(false)
    }
  }, [open])

  // Vorschau-URL sauber verwalten
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const pickFile = (f: File | null | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Bitte ein Bild (PNG/JPG) auswählen.')
      return
    }
    setFile(f)
  }

  const scan = async () => {
    if (!file) return
    setScanning(true)
    try {
      const res = await api.scanBankStatement(accountId, file)
      const count = res?.count ?? 0
      if (count > 0) toast.success(`${count} Buchung${count === 1 ? '' : 'en'} durch KI gespeichert.`)
      else toast.info('Keine Buchungen erkannt – anderes Bild versuchen.')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'KI-Scan fehlgeschlagen.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="KI-Kontoauszug-Scan">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-md border border-violet/25 bg-violet/[0.06] p-3.5">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-violet" />
          <p className="text-[13px] leading-relaxed text-text-secondary">
            Lade einen Screenshot oder ein Foto deines Kontoauszugs hoch. Gemini liest die Buchungen aus,
            ordnet Kategorien zu und trägt sie automatisch ein.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        {!file ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-elevated/50 px-6 py-10 text-center transition-colors hover:border-mint hover:bg-surface-elevated"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-surface-high text-mint">
              <ImagePlus size={24} />
            </span>
            <span className="text-[14px] font-semibold text-text-primary">Bild auswählen</span>
            <span className="text-[12px] text-text-muted">PNG oder JPG · tippen zum Hochladen</span>
          </button>
        ) : (
          <div className="relative overflow-hidden rounded-md border border-border bg-surface-elevated">
            {previewUrl && <img src={previewUrl} alt="Vorschau" className="max-h-64 w-full object-contain" />}
            <button
              onClick={() => setFile(null)}
              disabled={scanning}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-sm bg-black/60 text-text-primary transition-colors hover:bg-black/80 disabled:opacity-50"
            >
              <X size={16} />
            </button>
            <div className="truncate border-t border-border px-3 py-2 text-[12px] text-text-muted">{file.name}</div>
          </div>
        )}

        <button onClick={scan} disabled={!file || scanning} className="btn-primary w-full">
          {scanning ? (
            <>
              <Spinner size={18} className="border-on-mint/40 border-t-on-mint" />
              Gemini analysiert …
            </>
          ) : (
            <>
              <Sparkles size={18} strokeWidth={2.4} /> Analysieren &amp; eintragen
            </>
          )}
        </button>
      </div>
    </Modal>
  )
}
