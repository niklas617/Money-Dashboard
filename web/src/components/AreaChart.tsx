import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MONTHS_SHORT_DE } from '../lib/format'

export type ChartPoint = { date: string; value: number }

type Props = {
  data: ChartPoint[]
  height?: number
  color?: string
  colorSoft?: string
  formatValue: (v: number) => string
}

// Catmull-Rom -> kubische Bezier fuer eine weiche Kurve
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const t = 0.16
    const c1x = p1.x + (p2.x - p0.x) * t
    const c1y = p1.y + (p2.y - p0.y) * t
    const c2x = p2.x - (p3.x - p1.x) * t
    const c2y = p2.y - (p3.y - p1.y) * t
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

export function AreaChart({
  data,
  height = 210,
  color = '#35E0A1',
  colorSoft = '#5CEFC0',
  formatValue,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const gradId = useRef(`area-grad-${Math.random().toString(36).slice(2, 9)}`).current
  const lineGradId = `${gradId}-line`

  useLayoutEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const padTop = 14
  const padBottom = 24
  const padX = 6

  const geo = useMemo(() => {
    if (width === 0 || data.length === 0) return null
    const values = data.map((d) => d.value)
    let min = Math.min(...values)
    let max = Math.max(...values)
    let pad = (max - min) * 0.14
    if (pad === 0) pad = Math.abs(max) * 0.04 || 10
    min -= pad
    max += pad
    const range = max - min || 1
    const innerW = width - padX * 2
    const innerH = height - padTop - padBottom
    const n = data.length
    const stepX = n > 1 ? innerW / (n - 1) : 0

    const pts = data.map((d, i) => ({
      x: padX + (n > 1 ? i * stepX : innerW / 2),
      y: padTop + innerH - ((d.value - min) / range) * innerH,
    }))
    return { pts, min, max, innerH, stepX }
  }, [width, data, height])

  if (!geo) {
    return <div ref={wrapRef} style={{ height }} className="w-full" />
  }

  const { pts } = geo
  const line = smoothPath(pts)
  const areaPath =
    line +
    ` L ${pts[pts.length - 1].x} ${height - padBottom}` +
    ` L ${pts[0].x} ${height - padBottom} Z`

  const handleMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const x = clientX - rect.left
    let nearest = 0
    let best = Infinity
    for (let i = 0; i < pts.length; i++) {
      const dx = Math.abs(pts[i].x - x)
      if (dx < best) {
        best = dx
        nearest = i
      }
    }
    setHover(nearest)
  }

  const hoverPt = hover != null ? pts[hover] : null
  const hoverData = hover != null ? data[hover] : null

  // Monatswechsel-Labels
  const monthLabels: Array<{ x: number; text: string }> = []
  let prevMonth = -1
  data.forEach((d, i) => {
    const m = Number(d.date.slice(5, 7)) - 1
    if (m !== prevMonth && m >= 0 && m < 12) {
      monthLabels.push({ x: pts[i].x, text: MONTHS_SHORT_DE[m] })
      prevMonth = m
    }
  })

  // Tooltip-Position (bleibt im sichtbaren Bereich)
  const tipW = 132
  let tipX = hoverPt ? hoverPt.x - tipW / 2 : 0
  if (hoverPt) tipX = Math.max(padX, Math.min(width - tipW - padX, tipX))

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={handleMove}
        onTouchMove={handleMove}
        onTouchEnd={() => setHover(null)}
        className="block touch-none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colorSoft} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={`url(#${lineGradId})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {monthLabels.map((m, i) => (
          <text
            key={i}
            x={m.x}
            y={height - 6}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#616B66"
          >
            {m.text}
          </text>
        ))}

        {hoverPt && (
          <g>
            <line
              x1={hoverPt.x}
              y1={padTop - 4}
              x2={hoverPt.x}
              y2={height - padBottom}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
            <circle cx={hoverPt.x} cy={hoverPt.y} r={5} fill={color} stroke="#0A0C0D" strokeWidth={2.5} />
          </g>
        )}
      </svg>

      {hoverPt && hoverData && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border border-border bg-surface-high px-3 py-2 text-center shadow-card-lg"
          style={{ left: tipX, width: tipW }}
        >
          <div className="text-[11px] font-medium text-text-muted">{formatDateLabel(hoverData.date)}</div>
          <div className="tnum text-[13.5px] font-bold text-text-primary">{formatValue(hoverData.value)}</div>
        </div>
      )}
    </div>
  )
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}
