// Zentrale Formatierungs-Helfer (deutsche Locale, EUR)

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const eurSigned = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
})

/** 1234.5 -> "1.234,50 €" */
export function formatEUR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '–'
  return eur.format(value)
}

/** 1234.5 -> "+1.234,50 €" (Vorzeichen immer sichtbar) */
export function formatEURSigned(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '–'
  return eurSigned.format(value)
}

/** Kurse: kleine Krypto-Preise brauchen mehr Nachkommastellen */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '–'
  const abs = Math.abs(value)
  let digits = 2
  if (abs > 0 && abs < 1) digits = 6
  if (abs > 0 && abs < 0.01) digits = 8
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value)
}

/** Stueckzahl: bis zu 6 Nachkommastellen, aber ohne unnoetige Nullen */
export function formatQuantity(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '–'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value)
}

/** 12.3456 -> "+12,35 %" */
export function formatPercent(value: number | null | undefined, signed = true): string {
  if (value == null || Number.isNaN(value)) return '–'
  const s = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: signed ? 'always' : 'auto',
  }).format(value)
  return `${s} %`
}

/** ISO-Datum -> "19.07.2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export const MONTHS_SHORT_DE = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
]
