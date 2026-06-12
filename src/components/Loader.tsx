import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import lottie, { type AnimationItem } from 'lottie-web'

const BEE_LOTTIE_PATH = `${import.meta.env.BASE_URL}c5aaaea6-1184-11ee-9a35-6bda63c4fe7d.json`
const BEE_LOTTIE_SPEED = 1.45

interface Props {
  size?: number
  label?: string
  steps?: string[]
}

export default function Loader({ size = 60, label, steps }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const visibleSteps = steps?.filter(Boolean).slice(0, 3) ?? []
  const [stepIndex, setStepIndex] = useState(0)
  const displayLabel =
    visibleSteps.length > 0 ? (visibleSteps[stepIndex] ?? visibleSteps[0]) : label

  useEffect(() => {
    if (!containerRef.current) return

    const shouldReduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const animation: AnimationItem = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: !shouldReduceMotion,
      path: BEE_LOTTIE_PATH,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
      },
    })

    if (shouldReduceMotion) {
      animation.goToAndStop(0, true)
    } else {
      animation.setSpeed(BEE_LOTTIE_SPEED)
    }

    return () => {
      animation.destroy()
    }
  }, [])

  useEffect(() => {
    setStepIndex(0)
    if (visibleSteps.length < 2) return

    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= visibleSteps.length - 1) {
          window.clearInterval(timer)
          return current
        }
        return current + 1
      })
    }, 1400)

    return () => window.clearInterval(timer)
  }, [visibleSteps.length])

  return (
    <motion.div
      className="lynx-loader"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div
        className="lynx-loader__track"
        ref={containerRef}
        style={{ width: size * 1.2, height: size * 1.36 }}
        aria-hidden="true"
      />

      {displayLabel && (
        <span className="lynx-loader__label" aria-label={label ?? displayLabel}>
          <span className="lynx-loader__label-text">{displayLabel}</span>
          <span className="lynx-loader__dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </span>
      )}
    </motion.div>
  )
}
