import { useState } from 'react'

export const CHART_COLORS = [
  '#35E0A1', // mint
  '#56C8E8', // cyan
  '#A9B6FF', // periwinkle
  '#FFC24B', // amber
  '#FF8FA3', // rose
  '#7FE9CB', // helles mint
  '#C9A5FF', // violett
  '#63A9FF', // blau
]

export type DonutSlice = { label: string; value: number }

export function Donut({
  slices,
  size = 168,
  thickness = 26,
  centerLabel,
  centerValue,
  rounded = true,
  interactive = true,
}: {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
  rounded?: boolean
  interactive?: boolean
}) {
  const [active, setActive] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const gap = slices.length > 1 ? 0.012 * circ : 0 // kleine Luecke zwischen Segmenten

  let offset = 0
  const segs = slices.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0
    const len = Math.max(0, frac * circ - gap)
    const seg = { ...s, i, len, dashOffset: -offset, color: CHART_COLORS[i % CHART_COLORS.length], frac }
    offset += frac * circ
    return seg
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1B2024" strokeWidth={thickness} />
        {segs.map((s) => (
          <circle
            key={s.i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={active === s.i ? thickness + 5 : thickness}
            strokeDasharray={`${s.len} ${circ - s.len}`}
            strokeDashoffset={s.dashOffset}
            strokeLinecap={rounded ? 'round' : 'butt'}
            onMouseEnter={interactive ? () => setActive(s.i) : undefined}
            onMouseLeave={interactive ? () => setActive(null) : undefined}
            style={{ transition: 'stroke-width 0.18s ease', cursor: interactive ? 'pointer' : 'default' }}
          />
        ))}
      </g>
      {(centerValue || (interactive && active != null)) && (
        <>
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#616B66">
            {active != null ? segs[active].label : centerLabel}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="15" fontWeight="800" fill="#F1F5F3">
            {active != null ? `${(segs[active].frac * 100).toFixed(1)} %` : centerValue}
          </text>
        </>
      )}
    </svg>
  )
}
