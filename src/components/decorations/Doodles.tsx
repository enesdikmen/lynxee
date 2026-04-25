/**
 * Tiny sparkle decoration scattered around the poster.
 */
import type React from 'react'

type DoodleSparkleProps = {
  className?: string
  color?: string
  size?: number
  style?: React.CSSProperties
}

export function DoodleSparkle({
  className = '',
  color = 'rgb(var(--color-gold))',
  size = 32,
  style,
}: DoodleSparkleProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={`doodle doodle--sparkle ${className}`}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M20,4 L22,16 L34,14 L24,20 L32,30 L22,24 L20,36 L18,24 L8,30 L16,20 L6,14 L18,16Z"
        fill={color}
        opacity="0.8"
      />
    </svg>
  )
}
