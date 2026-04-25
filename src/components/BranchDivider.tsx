/**
 * Hand-drawn horizontal branch divider between poster sections.
 */
type BranchDividerProps = {
  flip?: boolean
  className?: string
}

function BranchDivider({ flip = false, className = '' }: BranchDividerProps) {
  return (
    <svg
      viewBox="0 0 600 28"
      className={`branch-divider ${className}`}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
    >
      <path
        d="M0,14 C40,10 80,18 120,14 C160,10 200,16 240,12 C280,8 320,18 360,14 C400,10 440,16 480,14 C520,12 560,16 600,14"
        fill="none"
        stroke="rgb(var(--color-ink))"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.18"
      />
      {/* Small leaves along the branch */}
      <ellipse cx="100" cy="10" rx="8" ry="4" fill="#86efac" opacity="0.5" transform="rotate(-20 100 10)" />
      <ellipse cx="250" cy="16" rx="7" ry="3.5" fill="#4ade80" opacity="0.45" transform="rotate(15 250 16)" />
      <ellipse cx="400" cy="10" rx="8" ry="4" fill="#86efac" opacity="0.5" transform="rotate(-25 400 10)" />
      <ellipse cx="520" cy="17" rx="6" ry="3" fill="#4ade80" opacity="0.4" transform="rotate(20 520 17)" />
      {/* Tiny berries */}
      <circle cx="60" cy="12" r="2.5" fill="#f87171" opacity="0.5" />
      <circle cx="310" cy="15" r="2" fill="#fbbf24" opacity="0.45" />
      <circle cx="470" cy="11" r="2.5" fill="#f87171" opacity="0.4" />
    </svg>
  )
}

export default BranchDivider
