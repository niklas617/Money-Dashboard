import { useId } from 'react'

/**
 * Monetra-App-Icon (das „M"). Wird für Login-Logo, Sidebar und überall als
 * Markenzeichen genutzt. Eigenes SVG mit eindeutigen Gradient-IDs pro Instanz,
 * damit mehrere Marks auf einer Seite (z. B. Sidebar + Mobile-Header) sich nicht
 * gegenseitig überschreiben.
 */
export function MonetraMark({ size = 40, className }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const bg = `mbg-${uid}`
  const glow = `mglow-${uid}`
  const mint = `mmint-${uid}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Monetra"
    >
      <defs>
        <linearGradient id={bg} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B1512" />
          <stop offset="100%" stopColor="#0F1C18" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="8%" r="70%">
          <stop offset="0%" stopColor="#123527" stopOpacity="1" />
          <stop offset="60%" stopColor="#0B1512" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={mint} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3DE8B0" />
          <stop offset="100%" stopColor="#1FB786" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${bg})`} />
      <rect width="512" height="512" rx="112" fill={`url(#${glow})`} />
      <rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="#1E362D" strokeWidth="1.5" />
      <g transform="translate(256,246)">
        <path
          d="M -96 78 L -96 -78 L -50 -78 L 0 -10 L 50 -78 L 96 -78 L 96 78 L 58 78 L 58 -18 L 12 46 L -12 46 L -58 -18 L -58 78 Z"
          fill={`url(#${mint})`}
        />
      </g>
      <rect x="196" y="368" width="120" height="6" rx="3" fill="#EAF7F1" opacity="0.85" />
    </svg>
  )
}
