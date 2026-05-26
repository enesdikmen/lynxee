/**
 * BentoPoster — full-page bento-style biodiversity poster.
 *
 * Tiles come from `buildBentoTiles` and are packed by `gridPacker` into a
 * tight rectangle. Filler tiles pad the layout so cells stay square. The
 * regenerate button reshuffles by bumping a single poster seed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CitySearch from '../components/CitySearch'
import { useLensData, type LensData } from '../hooks/useLensData'
import { packWithRetries, type BoxSpec, type Placement } from '../lib/gridPacker'
import { syncShareToLocation } from '../lib/shareToken'
import type { Place } from '../types/lens'
import { ALL_IMAGE_SOURCES } from '../api/speciesImage'
import {
  buildBentoTiles,
  padToRectangle,
  POSTER_GRID_AREA,
  POSTER_GRID_H,
  POSTER_GRID_W,
  type Tile,
} from './bentoTiles'
import './BentoPoster.css'

interface Props {
  selectedPlace: Place
  onPlaceChange: (place: Place) => void
  /** Optional seed restored from a shared URL. */
  initialSeed?: number
}

function BentoPoster({
  selectedPlace,
  onPlaceChange,
  initialSeed,
}: Props) {
  // Single seed for poster-level variation. Layout and data already consume it;
  // future style themes should derive from this same seed as well.
  const [posterSeed, setPosterSeed] = useState(
    initialSeed && Number.isFinite(initialSeed) ? initialSeed : 1,
  )
  const [shareCopied, setShareCopied] = useState(false)
  const GRID_W = POSTER_GRID_W

  const placeName = selectedPlace?.label?.split(',')[0]?.trim() ?? 'Pick a place'
  const latitude = selectedPlace?.latitude
  const longitude = selectedPlace?.longitude

  // Source priority is intentionally fixed in UI for a simpler experience.
  // To change fallback order later, edit `ALL_IMAGE_SOURCES` in
  // `src/api/speciesImage.ts`.
  const effectiveSources = ALL_IMAGE_SOURCES

  const data = useLensData(selectedPlace, {
    imageSources: effectiveSources,
    // Keep content choices tied to the same poster seed as layout.
    contentSeed: posterSeed,
  })

  // Freeze visual output to the last fully-ready snapshot for each place/source
  // selection. This avoids partial card churn while async pieces settle.
  const snapshotKey = useMemo(
    () => `${selectedPlace?.id ?? 'none'}::${effectiveSources.join(',')}`,
    [selectedPlace?.id, effectiveSources],
  )
  const [committedSnapshot, setCommittedSnapshot] = useState<{
    key: string
    data: LensData
  } | null>(null)

  useEffect(() => {
    if (!data.isReady) return
    if (committedSnapshot?.key === snapshotKey) return
    setCommittedSnapshot({ key: snapshotKey, data })
  }, [data, snapshotKey, committedSnapshot?.key])

  const displayData =
    committedSnapshot?.key === snapshotKey ? data : committedSnapshot?.data ?? null
  // Only show the loading overlay while we are waiting on the *first* ready
  // snapshot for the current place/sources. Regenerate (posterSeed bump)
  // keeps the same snapshotKey, so tiles update in place as new species
  // images stream in — the overlay does not flash back on.
  const isLoadingSnapshot = !displayData || committedSnapshot?.key !== snapshotKey

  // ── Per-card lock feature ─────────────────────────────────────────────
  // A locked tile freezes both its content (render closure + species ids)
  // and its grid position across Regenerate. Locks are keyed by `slotId`
  // (stable across content rotation, e.g. `mini-0`). When place or image
  // sources change the locked content becomes meaningless, so we
  // drop all locks.
  type Lock = { tile: Tile; x: number; y: number }
  const [locks, setLocks] = useState<Map<string, Lock>>(new Map())
  useEffect(() => {
    setLocks((prev) => (prev.size === 0 ? prev : new Map()))
  }, [selectedPlace?.id, effectiveSources.join(',')])

  // Keep the address bar in sync with the current place + seed so the URL
  // is always a shareable snapshot of what's on screen.
  useEffect(() => {
    if (!selectedPlace) return
    syncShareToLocation(selectedPlace, posterSeed)
  }, [selectedPlace, posterSeed])

  const handleShare = async () => {
    if (!selectedPlace) return
    syncShareToLocation(selectedPlace, posterSeed)
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1600)
    } catch {
      // Clipboard blocked (e.g. insecure context) — leave URL in address bar.
    }
  }

  const tiles = useMemo(() => {
    if (!displayData) return []
    const built = buildBentoTiles({
      placeName,
      latitude,
      longitude,
      data: displayData,
      contentSeed: posterSeed,
    })

    // Apply locks: replace locked slots with their frozen snapshot, drop
    // unlocked tiles that would duplicate a locked species, and append
    // any locked slots that aren't emitted by the fresh build.
    const lockedSlotIds = new Set(locks.keys())
    const lockedSpeciesIds = new Set<string>()
    for (const lock of locks.values()) {
      for (const sid of lock.tile.speciesIds ?? []) lockedSpeciesIds.add(sid)
    }
    const seenSlots = new Set<string>()
    const merged: Tile[] = []
    for (const t of built) {
      if (t.slotId && lockedSlotIds.has(t.slotId)) {
        const lock = locks.get(t.slotId)!
        merged.push({ ...lock.tile, pinXY: { x: lock.x, y: lock.y } })
        seenSlots.add(t.slotId)
        continue
      }
      // Drop any unlocked tile showing a species already claimed by a lock.
      if (t.speciesIds && t.speciesIds.some((id) => lockedSpeciesIds.has(id))) continue
      merged.push(t)
    }
    // Locked slots that no longer appear in the fresh build (e.g. a thematic
    // strip that dropped out for this seed) still need to be rendered.
    for (const [slotId, lock] of locks) {
      if (seenSlots.has(slotId)) continue
      merged.push({ ...lock.tile, pinXY: { x: lock.x, y: lock.y } })
    }

    return padToRectangle(merged, GRID_W, POSTER_GRID_AREA)
  }, [placeName, latitude, longitude, displayData, GRID_W, posterSeed, locks])

  // Pack the tiles into the fixed poster grid.
  //
  // We cache the pack result and re-use it whenever the seed/tile-set
  // is unchanged. This is what makes a Lock toggle a pure metadata update:
  // locking a card adds `pinXY` to one tile but does not change the tile id
  // list, so the cached placements are kept and nothing else on the poster
  // shuffles. A real Regenerate bumps `posterSeed`, which busts the cache.
  const packCacheRef = useRef<{
    key: string
    placements: Placement[]
    gridH: number
  } | null>(null)
  const { placements, gridH } = useMemo(() => {
    const cacheKey = `${posterSeed}|${GRID_W}|${tiles
      .map((t) => t.id)
      .join(',')}`
    if (packCacheRef.current?.key === cacheKey) {
      return {
        placements: packCacheRef.current.placements,
        gridH: packCacheRef.current.gridH,
      }
    }
    const h = POSTER_GRID_H
      // Hard pins are resolved against the *current* grid height attempt so
      // that e.g. `bottom-right` always means the actual bottom-right corner.
      const specs: BoxSpec[] = tiles.map((t) => {
        // Lock-card pin: freeze to an exact (x,y) regardless of corner.
        // Clamp y defensively to guarantee locked tiles stay in-bounds.
        if (t.pinXY) {
          const x = Math.max(0, Math.min(GRID_W - t.w, t.pinXY.x))
          const y = Math.max(0, Math.min(h - t.h, t.pinXY.y))
          return { id: t.id, w: t.w, h: t.h, constraint: { pin: { x, y } } }
        }
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
      const layoutSeed = posterSeed * 7919
      const r = packWithRetries({ width: GRID_W, height: h, boxes: specs, seed: layoutSeed }, 60)
      if (r) {
        packCacheRef.current = { key: cacheKey, placements: r.placements, gridH: h }
        return { placements: r.placements, gridH: h }
      }
    return { placements: [], gridH: POSTER_GRID_H }
  }, [tiles, posterSeed, GRID_W])

  const placementById = useMemo(() => {
    const m = new Map<string, (typeof placements)[number]>()
    for (const p of placements) m.set(p.id, p)
    return m
  }, [placements])

  const toggleLock = (t: Tile, p: { x: number; y: number }) => {
    if (!t.slotId) return
    const slotId = t.slotId
    setLocks((prev) => {
      const next = new Map(prev)
      if (next.has(slotId)) next.delete(slotId)
      else next.set(slotId, { tile: t, x: p.x, y: p.y })
      return next
    })
  }

  return (
    <div className="bento-shell">
      <div className="bento-toolbar">
        <CitySearch selected={selectedPlace} onSelect={onPlaceChange} />
        <button
          type="button"
          className="bento-toolbar__btn bento-toolbar__btn--primary"
          onClick={() => setPosterSeed((s) => s + 1)}
          title="Regenerate layout and data"
        >
          ↻ Regenerate
        </button>
        <button
          type="button"
          className="bento-toolbar__btn"
          onClick={handleShare}
          title="Copy a shareable link to this exact poster"
        >
          {shareCopied ? '✓ Link copied' : '↗ Share'}
        </button>
      </div>

      <div className={`bento-grid-wrap${isLoadingSnapshot ? ' bento-grid-wrap--loading' : ''}`}>
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
              const isLocked = !!t.slotId && locks.has(t.slotId)
              const canLock = !!t.slotId && !t.className.includes('bento-card--filler')
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                  className={t.className + (isLocked ? ' bento-card--locked' : '')}
                  style={{
                    gridColumn: `${p.x + 1} / span ${p.w}`,
                    gridRow: `${p.y + 1} / span ${p.h}`,
                  }}
                >
                  {canLock && (
                    <button
                      type="button"
                      className={
                        'bento-lock-btn' + (isLocked ? ' bento-lock-btn--on' : '')
                      }
                      onClick={() => toggleLock(t, { x: p.x, y: p.y })}
                      title={isLocked ? 'Unlock card' : 'Lock card content and position'}
                      aria-label={isLocked ? 'Unlock card' : 'Lock card'}
                      aria-pressed={isLocked}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
                        {isLocked ? (
                          <path
                            fill="currentColor"
                            d="M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1Zm2 0h8V8a4 4 0 1 0-8 0v2Z"
                          />
                        ) : (
                          <path
                            fill="currentColor"
                            d="M8 10V8a4 4 0 0 1 7.874-1 1 1 0 1 1-1.948.45A2 2 0 0 0 10 8v2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h3Z"
                          />
                        )}
                      </svg>
                    </button>
                  )}
                  {t.render()}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
        {isLoadingSnapshot && (
          <div className="bento-grid-loading" role="status" aria-live="polite">
            <div className="bento-grid-loading__panel">
              <span className="bento-grid-loading__dot" aria-hidden="true" />
              <span>Loading full place snapshot…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BentoPoster
