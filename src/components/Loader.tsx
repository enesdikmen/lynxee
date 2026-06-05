import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import lottie, { type AnimationItem } from 'lottie-web'

const BEE_LOTTIE_PATH = `${import.meta.env.BASE_URL}c5aaaea6-1184-11ee-9a35-6bda63c4fe7d.json`
const BEE_LOTTIE_SPEED = 1.25

interface Props {
  size?: number
  label?: string
}

export default function Loader({ size = 60, label }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

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

      {label && <span className="lynx-loader__label">{label}</span>}
    </motion.div>
  )
}
