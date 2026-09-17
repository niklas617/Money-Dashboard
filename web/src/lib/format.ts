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

/** Gewicht in Gramm menschlich formatieren: 1250 -> "1,25 kg", 41.06 -> "41,06 g" */
export function formatGrams(grams: number | null | undefined): string {
  if (grams == null || Number.isNaN(grams)) return '–'
  if (Math.abs(grams) >= 1000) {
    return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(grams / 1000)} kg`
  }
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(grams)} g`
}

/** Feinmenge in Gramm mit hoher Präzision: 31,1004 g (bis 4 Nachkommastellen, kg ab 1000 g) */
export function formatGramsFine(grams: number | null | undefined): string {
  if (grams == null || Number.isNaN(grams)) return '–'
  if (Math.abs(grams) >= 1000) {
    return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(grams / 1000)} kg`
  }
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(grams)} g`
}

/** Kurs pro Gramm: passende Nachkommastellen (Gold ~€120/g, Kupfer ~€0,01/g) */
export function formatPricePerGram(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '–'
  const abs = Math.abs(value)
  let digits = 2
  if (abs > 0 && abs < 1) digits = 4
  if (abs > 0 && abs < 0.1) digits = 5
  return `${new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value)} €/g`
}

/** ISO-Zeitstempel -> "16.09.2026, 14:32" (fuer „Stand"-Anzeige) */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16)
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Haltedauer seit einem Datum, grob: "1 J 3 M", "5 Mon.", "12 Tage" */
export function formatHoldingDuration(iso: string | null | undefined): string {
  if (!iso) return '–'
  const start = new Date(iso)
  if (Number.isNaN(start.getTime())) return '–'
  const now = new Date()
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 1) {
    const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000))
    return days === 1 ? '1 Tag' : `${days} Tage`
  }
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return rest === 1 ? '1 Monat' : `${rest} Monate`
  if (rest === 0) return years === 1 ? '1 Jahr' : `${years} Jahre`
  return `${years} J ${rest} M`
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

/**
 * Berechnet Einnahmen/Ausgaben für die Cashflow-Karte. Nimmt den laufenden Monat;
 * wenn dieser noch keine Buchungen hat (z. B. Monatsanfang), fällt sie automatisch
 * auf den jüngsten Monat mit Buchungen zurück – so ist die Karte nie leer.
 */
export function monthlyCashflow(
  txs: { amount: number; date: string | Date }[],
): { income: number; expense: number; monthLabel: string } {
  const now = new Date()
  const inMonth = (y: number, m: number) =>
    txs.some((t) => {
      const d = new Date(t.date)
      return d.getFullYear() === y && d.getMonth() === m
    })

  let year = now.getFullYear()
  let month = now.getMonth()
  if (!inMonth(year, month)) {
    let latest: Date | null = null
    for (const t of txs) {
      const d = new Date(t.date)
      if (!latest || d.getTime() > latest.getTime()) latest = d
    }
    if (latest) {
      year = latest.getFullYear()
      month = latest.getMonth()
    }
  }

  let income = 0
  let expense = 0
  for (const t of txs) {
    const d = new Date(t.date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      if (t.amount > 0) income += t.amount
      else expense += Math.abs(t.amount)
    }
  }
  return { income, expense, monthLabel: MONTHS_DE[month] }
}
