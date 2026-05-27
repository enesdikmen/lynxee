/**
 * BentoPoster — full-page bento-style biodiversity poster.
 *
 * Tiles come from `buildBentoTiles` and are packed by `gridPacker` into a
 * tight rectangle. Filler tiles pad the layout so cells stay square. The
 * regenerate button reshuffles by bumping a single poster seed.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CitySearch from '../components/CitySearch'
import { useLensData, type LensData } from '../hooks/useLensData'
import { packWithRetries, type BoxSpec, type Placement } from '../lib/gridPacker'
import { printPosterToPdf } from '../lib/printPoster'
import { encodeShare, syncShareToLocation } from '../lib/shareToken'
import type { LockEntry, LockListState } from '../lib/shareToken'
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
  /** Optional lock list restored from URL (`l=` param). */
  initialLocks?: LockListState
}

function BentoPoster({
  selectedPlace,
  onPlaceChange,
  initialSeed,
  initialLocks,
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

  // ── Per-card lock feature ─────────────────────────────────────────────
  // A locked tile freezes its content (which species/image it shows) AND
  // its grid position across Regenerate. The single-`lockSeed` invariant
  // says: every lock currently in the map was captured at the SAME poster
  // seed (`lockSeed`). Regenerate bumps `posterSeed` only; `lockSeed`
  // stays put so locks keep their old content. If the user adds a new lock
  // while `posterSeed !== lockSeed`, all existing locks "snap forward" to
  // the new seed (their content updates to match what's currently on
  // screen). This keeps the data layer cost bounded to two `useLensData`
  // calls regardless of how many locks exist.
  type Lock = { tile: Tile; x: number; y: number; captureSeed: number }
  const [locks, setLocks] = useState<Map<string, Lock>>(new Map())
  // `lockSeed` is the `posterSeed` snapshot every current lock was taken
  // at; `null` when the lock map is empty.
  const [lockSeed, setLockSeed] = useState<number | null>(
    initialLocks?.present && initialLocks.lockSeed ? initialLocks.lockSeed : null,
  )
  // True once the user has explicitly touched locks (added, removed, or
  // unlocked a default). Controls whether `l=` appears in the URL.
  const [userManagedLocks, setUserManagedLocks] = useState<boolean>(
    initialLocks?.present ?? false,
  )
  // Pending lock entries from the URL that still need to be matched
  // against `lockTiles` once that data hook finishes loading. Cleared
  // after the restore effect runs. State (not ref) so render & effects
  // can gate on it, and the URL-sync effect can avoid clobbering the
  // address bar with an empty `l=` while the restore is in flight.
  const [pendingLocks, setPendingLocks] = useState<LockEntry[] | null>(
    initialLocks?.present && initialLocks.locks.length > 0
      ? initialLocks.locks
      : null,
  )

  // Current-seed data feeds unlocked tiles. Lock-seed data feeds locked
  // tiles (so URL-restored locks reproduce exactly the content from the
  // seed they were captured at). When `lockSeed` matches `posterSeed` —
  // the common case after a fresh shuffle without locks, or right after
  // the first lock — react-query's cache makes the second hook a no-op.
  const data = useLensData(selectedPlace, {
    imageSources: effectiveSources,
    contentSeed: posterSeed,
  })
  const lockData = useLensData(selectedPlace, {
    imageSources: effectiveSources,
    contentSeed: lockSeed ?? posterSeed,
  })

  // Freeze visual output to the last fully-ready snapshot per (place,
  // sources). Avoids partial card churn while async pieces settle.
  const snapshotKey = useMemo(
    () => `${selectedPlace?.id ?? 'none'}::${effectiveSources.join(',')}`,
    [selectedPlace?.id, effectiveSources],
  )
  const [committedSnapshot, setCommittedSnapshot] = useState<{
    key: string
    data: LensData
    lockData: LensData
  } | null>(null)

  useEffect(() => {
    if (!data.isReady || !lockData.isReady) return
    if (committedSnapshot?.key === snapshotKey) return
    setCommittedSnapshot({ key: snapshotKey, data, lockData })
  }, [data, lockData, snapshotKey, committedSnapshot?.key])

  const displayData =
    committedSnapshot?.key === snapshotKey ? data : committedSnapshot?.data ?? null
  const displayLockData =
    committedSnapshot?.key === snapshotKey
      ? lockData
      : committedSnapshot?.lockData ?? null
  // Only show the loading overlay while waiting on the *first* ready
  // snapshot for the current place/sources. Regenerate keeps `snapshotKey`
  // unchanged so tiles update in place as new species images stream in.
  const isLoadingSnapshot =
    !displayData || committedSnapshot?.key !== snapshotKey || pendingLocks !== null

  // Reset lock state when the place or image sources change.
  const placeKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const key = `${selectedPlace?.id ?? 'none'}::${effectiveSources.join(',')}`
    if (placeKeyRef.current === null) {
      placeKeyRef.current = key
      return
    }
    if (placeKeyRef.current === key) return
    placeKeyRef.current = key
    setLocks((prev) => (prev.size === 0 ? prev : new Map()))
    setLockSeed(null)
    setUserManagedLocks(false)
    setDidInitDefaultLocks(false)
    setPendingLocks(null)
  }, [selectedPlace?.id, effectiveSources])

  // Keep the address bar in sync with current place + seed + locks.
  // Skip while URL-restored locks are still pending — otherwise the
  // first mount of a tab with `l=...` in the URL would briefly write
  // back an empty `l=` (locks Map is empty until the restore effect
  // runs), clobbering the URL for any concurrent reader (QR code,
  // copy-link, etc.).
  useEffect(() => {
    if (!selectedPlace) return
    if (pendingLocks !== null) return
    const lockState = userManagedLocks
      ? {
          lockSeed,
          locks: Array.from(locks.entries()).map(([slotId, l]) => ({
            slotId,
            x: l.x,
            y: l.y,
            captureSeed: l.captureSeed,
          })),
        }
      : null
    syncShareToLocation(selectedPlace, posterSeed, lockState)
  }, [selectedPlace, posterSeed, locks, lockSeed, userManagedLocks, pendingLocks])

  const handleShare = async () => {
    if (!selectedPlace) return
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1600)
    } catch {
      // Clipboard blocked (e.g. insecure context) — URL is already in bar.
    }
  }

  const handleDownloadPdf = () => {
    printPosterToPdf({
      gridW: GRID_W,
      gridH,
      placeName,
      seed: posterSeed,
    })
  }

  // Helper: build the unpadded tile list at a specific seed against a
  // given data snapshot. Used twice — once for current-seed unlocked
  // tiles and once for lock-seed locked tiles. Padding is deferred until
  // *after* lock merging so the final area is always `POSTER_GRID_AREA`.
  const buildTilesAt = (
    snapshot: LensData | null,
    seed: number,
  ): Tile[] => {
    if (!snapshot) return []
    let shareUrl: string | undefined
    if (typeof window !== 'undefined' && selectedPlace) {
      const url = new URL(window.location.href)
      url.searchParams.set('s', encodeShare(selectedPlace, seed))
      shareUrl = url.toString()
    }
    return buildBentoTiles({
      placeName,
      latitude,
      longitude,
      data: snapshot,
      contentSeed: seed,
      shareUrl,
    })
  }

  const baseTiles = useMemo(
    () => buildTilesAt(displayData, posterSeed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeName, latitude, longitude, displayData, posterSeed, selectedPlace],
  )
  const lockTiles = useMemo(
    () => buildTilesAt(displayLockData, lockSeed ?? posterSeed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeName, latitude, longitude, displayLockData, lockSeed, posterSeed, selectedPlace],
  )

  // Default locks: title pinned top-left, sources pinned bottom-right.
  // These always re-apply on initial load (per place) for any slot the
  // URL did not explicitly include in `l=`. This guarantees that two
  // tabs opening the same URL agree on title/sources placement, even if
  // the original tab had unlocked them locally (the unlocked state is
  // intentionally not persisted through URL sharing).
  //
  // Runs only after URL-restored locks have been resolved, so we never
  // double-apply a default position that the URL is about to override.
  const [didInitDefaultLocks, setDidInitDefaultLocks] = useState(false)
  useLayoutEffect(() => {
    if (didInitDefaultLocks) return
    if (pendingLocks !== null) return
    if (baseTiles.length === 0) return
    const title = baseTiles.find((t) => t.slotId === 'title')
    const sources = baseTiles.find((t) => t.slotId === 'sources')
    if (!title && !sources) {
      setDidInitDefaultLocks(true)
      return
    }
    // Default-locked title/sources are content-stable across seeds, so
    // it's safe to attach them at the current `lockSeed` if one already
    // exists (from URL-restored locks); otherwise anchor at `posterSeed`.
    const captureSeed = lockSeed ?? posterSeed
    let addedAny = false
    setLocks((prev) => {
      const next = new Map(prev)
      if (title && !next.has('title')) {
        next.set('title', { tile: title, x: 0, y: 0, captureSeed })
        addedAny = true
      }
      if (sources && !next.has('sources')) {
        next.set('sources', {
          tile: sources,
          x: GRID_W - sources.w,
          y: POSTER_GRID_H - sources.h,
          captureSeed,
        })
        addedAny = true
      }
      return addedAny ? next : prev
    })
    if (addedAny && lockSeed === null) setLockSeed(posterSeed)
    setDidInitDefaultLocks(true)
  }, [pendingLocks, baseTiles, didInitDefaultLocks, posterSeed, lockSeed, GRID_W])

  // URL-restored locks: once `lockTiles` is built at the captured seed,
  // resolve each pending lock entry against it and populate the lock map.
  useEffect(() => {
    if (!pendingLocks) return
    if (lockTiles.length === 0) return
    const resolved = new Map<string, Lock>()
    for (const entry of pendingLocks) {
      const tile = lockTiles.find((t) => t.slotId === entry.slotId)
      if (!tile) continue
      resolved.set(entry.slotId, {
        tile,
        x: entry.x,
        y: entry.y,
        captureSeed: entry.captureSeed,
      })
    }
    setLocks(resolved)
    setPendingLocks(null)
  }, [pendingLocks, lockTiles])

  const tiles = useMemo(() => {
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
    for (const t of baseTiles) {
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

    // Pad here (after locks) so the poster always has exactly
    // `POSTER_GRID_AREA` cells, no matter how many tiles locks added/dropped.
    return padToRectangle(merged, GRID_W, POSTER_GRID_AREA)
  }, [baseTiles, locks, GRID_W])

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
    const cacheKey = `${posterSeed}|${GRID_W}|d:${didInitDefaultLocks ? 1 : 0}|${tiles
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
  }, [tiles, posterSeed, GRID_W, didInitDefaultLocks])

  const placementById = useMemo(() => {
    const m = new Map<string, (typeof placements)[number]>()
    for (const p of placements) m.set(p.id, p)
    return m
  }, [placements])

  const toggleLock = (t: Tile, p: { x: number; y: number }) => {
    if (!t.slotId) return
    const slotId = t.slotId
    setUserManagedLocks(true)
    setLocks((prev) => {
      const next = new Map(prev)
      if (next.has(slotId)) {
        next.delete(slotId)
        if (next.size === 0) setLockSeed(null)
        return next
      }
      // Adding a new lock. If `posterSeed` differs from the existing
      // `lockSeed`, snap all existing locks forward — their tile is
      // rebuilt from the *current* baseTiles so they show what the user
      // sees now. The user explicitly chose to lock the current view, so
      // this is the only honest interpretation.
      if (lockSeed !== null && lockSeed !== posterSeed) {
        for (const [sid, existing] of next) {
          const fresh = baseTiles.find((b) => b.slotId === sid)
          if (fresh) {
            next.set(sid, { ...existing, tile: fresh, captureSeed: posterSeed })
          } else {
            // Slot no longer exists at the current seed → drop the lock.
            next.delete(sid)
          }
        }
      }
      next.set(slotId, { tile: t, x: p.x, y: p.y, captureSeed: posterSeed })
      setLockSeed(posterSeed)
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
        <button
          type="button"
          className="bento-toolbar__btn"
          onClick={handleDownloadPdf}
          disabled={isLoadingSnapshot}
          title="Open the browser print dialog — choose ‘Save as PDF’"
        >
          ⤓ PDF
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
                      <svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17">
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
