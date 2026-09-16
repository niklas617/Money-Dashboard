import { cn } from '../lib/cn'

// Zeitraum-Optionen fuer Kurscharts – identisch zur Flutter-App (RangeSelector).
export const RANGES = ['1W', '1M', '6M', '1J', '5J', 'MAX'] as const
export type Range = (typeof RANGES)[number]

const LABEL: Record<Range, string> = {
  '1W': '1W',
  '1M': '1M',
  '6M': '6M',
  '1J': '1J',
  '5J': '5J',
  MAX: 'Max',
}

/** Pill-Segmented-Control zur Auswahl des Chart-Zeitraums (mint = aktiv). */
export function RangeSelector({
  value,
  onChange,
}: {
  value: Range
  onChange: (r: Range) => void
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-pill border border-border bg-surface-high p-1">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'rounded-pill px-2.5 py-1 text-[12px] font-bold tnum transition-colors',
            r === value ? 'bg-mint text-on-mint' : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {LABEL[r]}
        </button>
      ))}
    </div>
  )
}
