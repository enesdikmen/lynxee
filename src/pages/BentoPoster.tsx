/**
 * BentoPoster — full-page bento-style biodiversity poster.
 *
 * Tiles come from `buildBentoTiles` and are packed by `gridPacker` into a
 * tight rectangle. Filler tiles pad the layout so cells stay square. The
 * regenerate button reshuffles by bumping the packer seed.
 */
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CitySearch from '../components/CitySearch'
import { useLensData } from '../hooks/useLensData'
import { packWithRetries, type BoxSpec } from '../lib/gridPacker'
import type { Place } from '../types/lens'
import {
  ALL_IMAGE_SOURCES,
  IMAGE_SOURCE_LABELS,
  clearSpeciesImageCache,
  type ImageSource,
} from '../api/speciesImage'
import { buildBentoTiles, padToRectangle } from './bentoTiles'
import './BentoPoster.css'

const GRID_W = 6

interface Props {
  selectedPlace: Place
  onPlaceChange: (place: Place) => void
  imageSources: ImageSource[]
  onImageSourcesChange: (next: ImageSource[]) => void
  onOpenSandbox: () => void
}

function BentoPoster({
  selectedPlace,
  onPlaceChange,
  imageSources,
  onImageSourcesChange,
  onOpenSandbox,
}: Props) {
  const [seed, setSeed] = useState(1)

  const placeName = selectedPlace?.label?.split(',')[0]?.trim() ?? 'Pick a place'
  const latitude = selectedPlace?.latitude
  const longitude = selectedPlace?.longitude

  const data = useLensData(selectedPlace, { imageSources })

  const tiles = useMemo(
    () => padToRectangle(buildBentoTiles({ placeName, latitude, longitude, data }), GRID_W),
    [placeName, latitude, longitude, data],
  )

  // Pack the tiles. The total area is a multiple of GRID_W thanks to the
  // padding, so the exact-height rectangle should always fit. Allow up to
  // +2 rows of slack in case anchor constraints make the tightest layout
  // infeasible.
  const { placements, gridH } = useMemo(() => {
    const exactH = tiles.reduce((s, t) => s + t.w * t.h, 0) / GRID_W
    for (let h = exactH; h <= exactH + 2; h++) {
      // Hard pins are resolved against the *current* grid height attempt so
      // that e.g. `bottom-right` always means the actual bottom-right corner.
      const specs: BoxSpec[] = tiles.map((t) => {
        if (t.pin) {
          const x = t.pin === 'top-right' || t.pin === 'bottom-right' ? GRID_W - t.w : 0
          const y = t.pin === 'bottom-left' || t.pin === 'bottom-right' ? h - t.h : 0
          return { id: t.id, w: t.w, h: t.h, constraint: { pin: { x, y } } }
        }
        if (t.anchor) {
          return { id: t.id, w: t.w, h: t.h, constraint: { anchor: t.anchor } }
        }
        return { id: t.id, w: t.w, h: t.h }
      })
      const r = packWithRetries({ width: GRID_W, height: h, boxes: specs, seed }, 60)
      if (r) return { placements: r.placements, gridH: h }
    }
    return { placements: [], gridH: exactH }
  }, [tiles, seed])

  const placementById = useMemo(() => {
    const m = new Map<string, (typeof placements)[number]>()
    for (const p of placements) m.set(p.id, p)
    return m
  }, [placements])

  return (
    <div className="bento-shell">
      <div className="bento-toolbar">
        <CitySearch selected={selectedPlace} onSelect={onPlaceChange} />
        <span className="bento-toolbar__sources" title="Image sources, tried in order">
          <span className="bento-toolbar__sources-label">Images:</span>
          {ALL_IMAGE_SOURCES.map((source) => {
            const active = imageSources.includes(source)
            return (
              <label key={source} className="bento-toolbar__check">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => {
                    // Maintain canonical order from ALL_IMAGE_SOURCES so the
                    // fallback chain stays predictable when toggling.
                    const next = e.target.checked
                      ? ALL_IMAGE_SOURCES.filter(
                          (s) => s === source || imageSources.includes(s),
                        )
                      : imageSources.filter((s) => s !== source)
                    clearSpeciesImageCache()
                    onImageSourcesChange(next)
                  }}
                />
                {IMAGE_SOURCE_LABELS[source]}
              </label>
            )
          })}
        </span>
        <button
          type="button"
          className="bento-toolbar__btn bento-toolbar__btn--primary"
          onClick={() => setSeed((s) => s + 1)}
          title="Regenerate layout"
        >
          ↻ Regenerate
        </button>
        <button
          type="button"
          onClick={onOpenSandbox}
          className="bento-toolbar__btn"
          title="Open layout packer sandbox"
        >
          ⚙ Layout Lab
        </button>
      </div>

      <div
        className="bento-grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_W}, 1fr)`,
          gridTemplateRows: `repeat(${gridH}, 1fr)`,
          aspectRatio: `${GRID_W} / ${gridH}`,
        }}
      >
        <AnimatePresence>
          {tiles.map((t) => {
            const p = placementById.get(t.id)
            if (!p) return null
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                className={t.className}
                style={{
                  gridColumn: `${p.x + 1} / span ${p.w}`,
                  gridRow: `${p.y + 1} / span ${p.h}`,
                }}
              >
                {t.render()}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default BentoPoster
