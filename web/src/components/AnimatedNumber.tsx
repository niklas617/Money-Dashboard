import { useEffect, useRef, useState } from 'react'

/**
 * Zaehlt einen Zahlenwert sanft hoch, wenn er sich aendert.
 * `format` bestimmt die Darstellung (z. B. Euro).
 */
export function AnimatedNumber({
  value,
  format,
  duration = 900,
  className,
}: {
  value: number
  format: (v: number) => string
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) {
      setDisplay(to)
      return
    }
    startRef.current = null

    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t
      const elapsed = t - startRef.current
      const p = Math.min(1, elapsed / duration)
      // easeOutExpo
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      setDisplay(from + (to - from) * eased)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fromRef.current = value
    }
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
