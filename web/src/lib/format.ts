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

/**
 * Parst einen deutschen Geldbetrag aus einem Eingabefeld zu einer Zahl.
 *
 * Konvention (wie in allen Anzeigen der App): Komma = Dezimaltrennzeichen,
 * Punkt = Tausendertrennzeichen. Beispiele:
 *   "1.234,56" -> 1234.56   "10.086" -> 10086   "10,5" -> 10.5   "9,99" -> 9.99
 * Zur Sicherheit werden auch englische Eingaben verstanden ("1,234.56", "10.5").
 * Gibt NaN bei ungültiger Eingabe zurück.
 */
export function parseAmount(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input
  if (input == null) return NaN
  const s = String(input).trim().replace(/[\s€]/g, '')
  if (!s) return NaN

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  let normalized = s

  if (hasComma && hasDot) {
    // Beides vorhanden: das zuletzt stehende Zeichen ist das Dezimaltrennzeichen.
    normalized =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.') // deutsch: 1.234,56
        : s.replace(/,/g, '') // englisch: 1,234.56
  } else if (hasComma) {
    normalized = s.replace(',', '.') // 1234,56
  } else if (hasDot) {
    // Nur Punkt(e): mehrere Punkte oder ein Punkt mit exakt 3 Folgeziffern
    // = Tausendertrennung (10.086, 1.234.567). Sonst Dezimalpunkt (10.5).
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, '')
  }

  return Number(normalized)
}

/**
 * Parst Kurs-/Mengeneingaben (Portfolio, Alerts). Wie {@link parseAmount}, aber
 * ein einzelner Punkt bleibt IMMER Dezimalpunkt – bei Krypto sind Werte < 1 mit
 * drei Nachkommastellen normal (z. B. "0.086"). Nur mehrere Punkte gelten als
 * Tausendertrennung ("1.234.567"). Gibt NaN bei ungültiger Eingabe zurück.
 */
export function parseDecimal(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input
  if (input == null) return NaN
  const s = String(input).trim().replace(/[\s€]/g, '')
  if (!s) return NaN

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  let normalized = s

  if (hasComma && hasDot) {
    // Beides vorhanden: das zuletzt stehende Zeichen ist das Dezimaltrennzeichen.
    normalized =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.') // deutsch: 1.234,56
        : s.replace(/,/g, '') // englisch: 1,234.56
  } else if (hasComma) {
    normalized = s.replace(',', '.') // 0,086
  } else if (hasDot) {
    // Mehrere Punkte = Tausendertrennung; ein einzelner Punkt bleibt Dezimalpunkt.
    if ((s.match(/\./g) || []).length > 1) normalized = s.replace(/\./g, '')
  }

  return Number(normalized)
}

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
