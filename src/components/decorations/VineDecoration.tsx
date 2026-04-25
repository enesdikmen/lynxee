/**
 * Decorative vine/branch that runs along the left or right side of the poster.
 */
type VineDecorationProps = {
  side?: 'left' | 'right'
  className?: string
}

function VineDecoration({ side = 'left', className = '' }: VineDecorationProps) {
  const isRight = side === 'right'

  return (
    <div
      className={`vine-decoration vine-decoration--${side} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 60 600"
        className="vine-decoration__svg"
        style={isRight ? { transform: 'scaleX(-1)' } : undefined}
      >
        {/* Main stem */}
        <path
          d="M30,0 C32,40 26,80 30,120 C34,160 24,200 28,240 C32,280 22,320 26,360 C30,400 20,440 24,480 C28,520 18,560 22,600"
          fill="none"
          stroke="#4ade80"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
        {/* Small leaves along the vine */}
        <ellipse cx="22" cy="60" rx="10" ry="5" fill="#86efac" opacity="0.6" transform="rotate(-30 22 60)" />
        <ellipse cx="36" cy="140" rx="9" ry="4.5" fill="#4ade80" opacity="0.5" transform="rotate(25 36 140)" />
        <ellipse cx="18" cy="220" rx="11" ry="5" fill="#86efac" opacity="0.55" transform="rotate(-20 18 220)" />
        <ellipse cx="34" cy="310" rx="8" ry="4" fill="#4ade80" opacity="0.45" transform="rotate(35 34 310)" />
        <ellipse cx="20" cy="400" rx="10" ry="5" fill="#86efac" opacity="0.5" transform="rotate(-25 20 400)" />
        <ellipse cx="32" cy="480" rx="9" ry="4.5" fill="#4ade80" opacity="0.4" transform="rotate(20 32 480)" />
        <ellipse cx="24" cy="560" rx="8" ry="4" fill="#86efac" opacity="0.35" transform="rotate(-15 24 560)" />

        {/* Tiny berries/dots */}
        <circle cx="14" cy="100" r="3" fill="#f87171" opacity="0.6" />
        <circle cx="38" cy="180" r="2.5" fill="#fbbf24" opacity="0.5" />
        <circle cx="12" cy="270" r="3" fill="#f87171" opacity="0.5" />
        <circle cx="40" cy="360" r="2" fill="#fbbf24" opacity="0.45" />
        <circle cx="16" cy="450" r="2.5" fill="#f87171" opacity="0.4" />
        <circle cx="36" cy="540" r="2" fill="#fbbf24" opacity="0.35" />
      </svg>
    </div>
  )
}

export default VineDecoration
