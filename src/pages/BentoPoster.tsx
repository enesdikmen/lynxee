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
import Loader from '../components/Loader'
import { useLensData, type LensData } from '../hooks/useLensData'
import { packWithRetries, type BoxSpec, type Placement } from '../lib/gridPacker'
import { printPosterToPdf } from '../lib/printPoster'
import {
  getUiText,
  normalizeUiLanguage,
  UI_LANGUAGES,
  type UiLanguage,
} from '../i18n/uiText'
import {
  encodeLocks,
  encodeShare,
  decodeLocks,
  syncShareToLocation,
} from '../lib/shareToken'
import type { LockEntry, LockListState } from '../lib/shareToken'
import type { Place } from '../types/lens'
import { ALL_IMAGE_SOURCES } from '../api/speciesImage'
import {
  buildBentoTiles,
  buildSpeciesBackupTiles,
  buildThematicBackupTiles,
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
  /** Optional language restored from URL (`lang=` param). */
  initialLanguage?: string
}

function BentoPoster({
  selectedPlace,
  onPlaceChange,
  initialSeed,
  initialLocks,
  initialLanguage,
}: Props) {
  // Single seed for poster-level variation. Layout and data already consume it;
  // future style themes should derive from this same seed as well.
  const [posterSeed, setPosterSeed] = useState(
    initialSeed && Number.isFinite(initialSeed) ? initialSeed : 1,
  )
  const [commonNameLanguage, setCommonNameLanguage] = useState<UiLanguage>(() =>
    normalizeUiLanguage(initialLanguage),
  )
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const uiText = getUiText(commonNameLanguage)
  const GRID_W = POSTER_GRID_W
  const languageMenuRef = useRef<HTMLDivElement | null>(null)
  const closeLanguageMenu = () => setIsLanguageMenuOpen(false)
  const selectLanguage = (language: UiLanguage) => {
    setCommonNameLanguage(language)
    closeLanguageMenu()
  }

  const placeName = selectedPlace?.label?.split(',')[0]?.trim() ?? 'Pick a place'
  const latitude = selectedPlace?.latitude
  const longitude = selectedPlace?.longitude

  // Source priority is intentionally fixed in UI for a simpler experience.
  // To change fallback order later, edit `ALL_IMAGE_SOURCES` in
  // `src/api/speciesImage.ts`.
  const effectiveSources = ALL_IMAGE_SOURCES

  // Per-card locks freeze tile content + position across Regenerate.
  // Unlock is visual-only until next Regenerate (via unlockOverrides).
  // Each lock stores its own captureSeed for mixed-seed restore.
  type Lock = { tile: Tile; x: number; y: number; captureSeed: number }
  const [locks, setLocks] = useState<Map<string, Lock>>(new Map())
  // Recently unlocked tiles stay visually frozen until the next Regenerate.
  // This keeps lock/unlock actions from swapping species immediately.
  const [unlockOverrides, setUnlockOverrides] = useState<Map<string, Lock>>(new Map())
  // True once the user has explicitly touched locks (added, removed, or
  // unlocked a default). Controls whether `l=` appears in the URL.
  const [userManagedLocks, setUserManagedLocks] = useState<boolean>(
    initialLocks?.present ?? false,
  )
  // Pending URL lock entries waiting to be resolved against loaded tiles.
  // Kept in state so effects/UI can gate while restore is in flight.
  const [pendingLocks, setPendingLocks] = useState<LockEntry[] | null>(
    initialLocks?.present && initialLocks.locks.length > 0
      ? initialLocks.locks
      : null,
  )
  // Active seed for lock restore. We process one captureSeed at a time.
  const [restoreSeed, setRestoreSeed] = useState<number | null>(
    initialLocks?.present && initialLocks.locks.length > 0
      ? initialLocks.locks[0].captureSeed
      : null,
  )

  // Current-seed data feeds unlocked tiles. The lockData hook is parked
  // at the active restore seed (or mirrors posterSeed when nothing is
  // being restored — cheap react-query cache hit in that case).
  const data = useLensData(selectedPlace, {
    imageSources: effectiveSources,
    contentSeed: posterSeed,
    commonNameLanguage,
  })
  const isLockRestoreActive = pendingLocks !== null && restoreSeed !== null
  const lockData = useLensData(selectedPlace, {
    imageSources: effectiveSources,
    contentSeed: restoreSeed ?? posterSeed,
    commonNameLanguage,
    enabled: isLockRestoreActive,
  })

  // Freeze visual output to the last fully-ready snapshot per (place,
  // sources). Avoids partial card churn while async pieces settle. Locks
  // are rendered from their stored tile objects (the locks Map), so the
  // snapshot only needs to track current-seed data.
  const snapshotKey = useMemo(
    () => `${selectedPlace?.id ?? 'none'}::${effectiveSources.join(',')}`,
    [selectedPlace?.id, effectiveSources],
  )
  const [committedSnapshot, setCommittedSnapshot] = useState<{
    key: string
    data: LensData
  } | null>(null)
  const wasDataReadyRef = useRef(false)
  const previousLanguageRef = useRef(commonNameLanguage)

  useEffect(() => {
    const becameReady = data.isReady && !wasDataReadyRef.current
    const keyChanged = committedSnapshot?.key !== snapshotKey
    if (data.isReady && (becameReady || keyChanged)) {
      setCommittedSnapshot({ key: snapshotKey, data })
    }
    wasDataReadyRef.current = data.isReady
  }, [data, snapshotKey, committedSnapshot?.key])

  // When language changes, re-resolve currently locked slots from their
  // original captureSeed so names localize without altering species picks
  // or tile positions.
  useEffect(() => {
    if (previousLanguageRef.current === commonNameLanguage) return
    previousLanguageRef.current = commonNameLanguage
    if (pendingLocks !== null) return
    if (locks.size === 0) return

    const refreshLocks = Array.from(locks.entries()).map(([slotId, l]) => ({
      slotId,
      x: l.x,
      y: l.y,
      captureSeed: l.captureSeed,
    }))
    if (refreshLocks.length === 0) return

    setPendingLocks(refreshLocks)
    setRestoreSeed(refreshLocks[0].captureSeed)
  }, [commonNameLanguage, locks, pendingLocks])

  useEffect(() => {
    if (!isLanguageMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        closeLanguageMenu()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLanguageMenu()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isLanguageMenuOpen])

  const displayData = data.isReady ? data : committedSnapshot?.data ?? null
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
    setUnlockOverrides((prev) => (prev.size === 0 ? prev : new Map()))
    setUserManagedLocks(false)
    setDidInitDefaultLocks(false)
    setPendingLocks(null)
    setRestoreSeed(null)
  }, [selectedPlace?.id, effectiveSources])

  // Encode the current lock state into URL form. Centralised so the URL
  // sync effect and the dev-mode round-trip assertion stay in lockstep.
  const currentLockEntries = useMemo<LockEntry[]>(
    () =>
      Array.from(locks.entries()).map(([slotId, l]) => ({
        slotId,
        x: l.x,
        y: l.y,
        captureSeed: l.captureSeed,
      })),
    [locks],
  )

  // Keep the address bar in sync with current place + seed + locks.
  // Skip while URL-restored locks are still pending — otherwise the
  // first mount of a tab with `l=...` in the URL would briefly write
  // back a partial `l=` (locks Map is empty until the restore effect
  // runs), clobbering the URL for any concurrent reader (QR code,
  // copy-link, etc.).
  useEffect(() => {
    if (!selectedPlace) return
    if (pendingLocks !== null) return
    const lockState = userManagedLocks ? { locks: currentLockEntries } : null
    syncShareToLocation(selectedPlace, posterSeed, lockState, commonNameLanguage)

    // Dev assertion: paste → decode → state → encode is a fixed point.
    if (import.meta.env.DEV && lockState) {
      const encoded = encodeLocks(lockState.locks)
      const decoded = decodeLocks(encoded)
      const reencoded = encodeLocks(decoded.locks)
      if (encoded !== reencoded) {
        console.warn(
          '[locks] encode/decode round-trip mismatch:',
          { encoded, reencoded, decoded },
        )
      }
    }
  }, [
    selectedPlace,
    posterSeed,
    currentLockEntries,
    userManagedLocks,
    pendingLocks,
    commonNameLanguage,
  ])

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
      url.searchParams.set('lang', commonNameLanguage)
      shareUrl = url.toString()
    }
    return buildBentoTiles({
      placeName,
      latitude,
      longitude,
      data: snapshot,
      contentSeed: seed,
      shareUrl,
      language: commonNameLanguage,
      uiText,
    })
  }

  const baseTiles = useMemo(
    () => buildTilesAt(displayData, posterSeed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeName, latitude, longitude, displayData, posterSeed, selectedPlace, commonNameLanguage, uiText],
  )

  // Default locks: title top-left, sources bottom-right.
  // Applied only when URL did not provide those slots.
  const [didInitDefaultLocks, setDidInitDefaultLocks] = useState(false)
  useLayoutEffect(() => {
    if (didInitDefaultLocks) return
    if (pendingLocks !== null) return
    if (baseTiles.length === 0) return
    // Prevent default-lock capture from a stale place snapshot.
    if (committedSnapshot?.key !== snapshotKey) return
    const title = baseTiles.find((t) => t.slotId === 'title')
    const sources = baseTiles.find((t) => t.slotId === 'sources')
    if (!title && !sources) {
      setDidInitDefaultLocks(true)
      return
    }
    // Default locks anchor at the current seed.
    const captureSeed = posterSeed
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
    setDidInitDefaultLocks(true)
  }, [pendingLocks, baseTiles, didInitDefaultLocks, posterSeed, GRID_W, committedSnapshot?.key, snapshotKey])

  // Restore URL locks one captureSeed at a time.
  // Missing slots at a seed are dropped with a dev warning.
  useEffect(() => {
    if (!pendingLocks || restoreSeed === null) return
    if (!lockData.isReady) return
    // Build tiles at exactly `restoreSeed` using freshly-fetched lockData.
    let restoreShareUrl: string | undefined
    if (typeof window !== 'undefined' && selectedPlace) {
      const url = new URL(window.location.href)
      url.searchParams.set('s', encodeShare(selectedPlace, restoreSeed))
      url.searchParams.set('lang', commonNameLanguage)
      restoreShareUrl = url.toString()
    }
    const restoredTiles = [
      ...buildBentoTiles({
      placeName,
      latitude,
      longitude,
      data: lockData,
      contentSeed: restoreSeed,
      shareUrl: restoreShareUrl,
      language: commonNameLanguage,
      uiText,
      }),
      ...buildThematicBackupTiles(lockData, commonNameLanguage, uiText),
    ]
    const resolved = new Map<string, Lock>()
    const remaining: LockEntry[] = []
    for (const entry of pendingLocks) {
      if (entry.captureSeed !== restoreSeed) {
        remaining.push(entry)
        continue
      }
      const tile = restoredTiles.find((t) => t.slotId === entry.slotId)
      if (!tile) {
        if (import.meta.env.DEV) {
          console.warn(
            `[locks] could not resolve slot "${entry.slotId}" at captureSeed=${entry.captureSeed}; dropping entry`,
          )
        }
        // Intentionally not pushed to remaining → done after this pass.
        continue
      }
      resolved.set(entry.slotId, {
        tile,
        x: entry.x,
        y: entry.y,
        captureSeed: entry.captureSeed,
      })
    }
    setLocks((prev) => {
      const next = new Map(prev)
      // Replace every slot captured at this seed with freshly resolved
      // tiles (or drop when no longer resolvable).
      for (const entry of pendingLocks) {
        if (entry.captureSeed === restoreSeed) next.delete(entry.slotId)
      }
      for (const [slotId, lock] of resolved) next.set(slotId, lock)
      return next
    })
    if (remaining.length === 0) {
      setPendingLocks(null)
      setRestoreSeed(null)
      return
    }
    setPendingLocks(remaining)
    setRestoreSeed(remaining[0].captureSeed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLocks, restoreSeed, lockData.isReady])

  const tiles = useMemo(() => {
    // Apply locks: replace locked slots with their frozen snapshot, drop
    // unlocked tiles that would duplicate a locked/override species, and
    // append any locked/override slots that aren't emitted by the fresh
    // build.
    const lockedSlotIds = new Set(locks.keys())
    const overrideSlotIds = new Set(unlockOverrides.keys())
    const lockedSpeciesIds = new Set<string>()
    for (const lock of locks.values()) {
      for (const sid of lock.tile.speciesIds ?? []) lockedSpeciesIds.add(sid)
    }
    for (const override of unlockOverrides.values()) {
      for (const sid of override.tile.speciesIds ?? []) lockedSpeciesIds.add(sid)
    }
    const seenSlots = new Set<string>()
    const merged: Tile[] = []
    for (const t of baseTiles) {
      if (t.slotId && lockedSlotIds.has(t.slotId)) {
        const lock = locks.get(t.slotId)!
        // Keep sources content live (QR/data text) while preserving its
        // locked position. Other locked slots stay fully frozen.
        if (t.slotId === 'sources') {
          merged.push({ ...t, pinXY: { x: lock.x, y: lock.y } })
        } else {
          merged.push({ ...lock.tile, pinXY: { x: lock.x, y: lock.y } })
        }
        seenSlots.add(t.slotId)
        continue
      }
      if (t.slotId && overrideSlotIds.has(t.slotId)) {
        const lock = unlockOverrides.get(t.slotId)!
        merged.push({ ...lock.tile })
        seenSlots.add(t.slotId)
        continue
      }
      // Drop any unlocked tile showing a species already claimed by a lock.
      if (t.speciesIds && t.speciesIds.some((id) => lockedSpeciesIds.has(id))) continue
      merged.push(t)
    }
    // Locked slots that no longer appear in the fresh build (e.g. a thematic
    // strip that dropped out for this seed) still need to be rendered — but
    // only while they fit. Appending a stale locked tile onto an already-full
    // 24-cell grid would make the tile set unpackable, so `pack()` returns
    // null and the whole poster renders empty. Guard the running area so the
    // merged set is always within `POSTER_GRID_AREA` and stays packable.
    let usedArea = merged.reduce((sum, t) => sum + t.w * t.h, 0)
    for (const [slotId, lock] of locks) {
      if (seenSlots.has(slotId)) continue
      const area = lock.tile.w * lock.tile.h
      if (usedArea + area > POSTER_GRID_AREA) continue
      merged.push({ ...lock.tile, pinXY: { x: lock.x, y: lock.y } })
      usedArea += area
    }
    for (const [slotId, lock] of unlockOverrides) {
      if (seenSlots.has(slotId)) continue
      const area = lock.tile.w * lock.tile.h
      if (usedArea + area > POSTER_GRID_AREA) continue
      merged.push({ ...lock.tile })
      usedArea += area
    }

    // Optional thematic fallback: if lock collisions made us short, use up
    // to two precomputed backup thematics before inserting invisible filler.
    const mergedArea = usedArea
    if (mergedArea < POSTER_GRID_AREA && displayData) {
      let missingArea = POSTER_GRID_AREA - mergedArea
      const occupiedSlotIds = new Set(
        merged
          .map((t) => t.slotId)
          .filter((slotId): slotId is string => !!slotId),
      )
      const occupiedIds = new Set(merged.map((t) => t.id))
      const occupiedSpeciesIds = new Set<string>()
      for (const tile of merged) {
        for (const sid of tile.speciesIds ?? []) occupiedSpeciesIds.add(sid)
      }

      const tryAppendBackups = (backups: Tile[]) => {
        for (const backup of backups) {
          if (missingArea <= 0) break
          const area = backup.w * backup.h
          if (area > missingArea) continue
          const hasSameSlot = !!backup.slotId && occupiedSlotIds.has(backup.slotId)
          const hasSameId = occupiedIds.has(backup.id)
          const collidesWithVisibleSpecies =
            !!backup.speciesIds?.some((id) => occupiedSpeciesIds.has(id))
          if (hasSameSlot || hasSameId || collidesWithVisibleSpecies) continue

          merged.push(backup)
          occupiedIds.add(backup.id)
          if (backup.slotId) occupiedSlotIds.add(backup.slotId)
          for (const sid of backup.speciesIds ?? []) occupiedSpeciesIds.add(sid)
          missingArea -= area
        }
      }

      // 1) Try thematic backups (extra themes that survived dedup).
      tryAppendBackups(
        buildThematicBackupTiles(displayData, commonNameLanguage, uiText),
      )
      // 2) Then unused threatened/signature species — covers cases where
      //    atRisk/signature builds emitted fewer tiles than expected (e.g.
      //    sparse threatened pool) or where lock collisions dropped a
      //    tile and no thematic backup was free of conflicts.
      if (missingArea > 0) {
        tryAppendBackups(
          buildSpeciesBackupTiles(displayData, commonNameLanguage, uiText),
        )
      }
    }

    // Pad here (after locks) so the poster always has exactly
    // `POSTER_GRID_AREA` cells, no matter how many tiles locks added/dropped.
    return padToRectangle(merged, GRID_W, POSTER_GRID_AREA)
  }, [baseTiles, locks, unlockOverrides, GRID_W, displayData, commonNameLanguage, uiText])

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
    const isLockedNow = locks.has(slotId)

    // Unlock: keep the currently visible tile frozen until next Regenerate
    // so unlock itself does not swap species/content.
    if (isLockedNow) {
      setUnlockOverrides((prev) => {
        const next = new Map(prev)
        next.set(slotId, { tile: t, x: p.x, y: p.y, captureSeed: posterSeed })
        return next
      })
      setLocks((prev) => {
        if (!prev.has(slotId)) return prev
        const next = new Map(prev)
        next.delete(slotId)
        return next
      })
      return
    }

    // Lock: clear any temporary override and freeze exactly what is visible.
    setUnlockOverrides((prev) => {
      if (!prev.has(slotId)) return prev
      const next = new Map(prev)
      next.delete(slotId)
      return next
    })
    setLocks((prev) => {
      const next = new Map(prev)
      next.set(slotId, { tile: t, x: p.x, y: p.y, captureSeed: posterSeed })
      return next
    })
  }

  return (
    <div className="bento-shell">
      <div className="bento-toolbar">
        <CitySearch
          selected={selectedPlace}
          onSelect={onPlaceChange}
          language={commonNameLanguage}
          text={uiText.citySearch}
        />
        <button
          type="button"
          className="bento-toolbar__btn bento-toolbar__btn--primary"
          onClick={() => {
            setUnlockOverrides((prev) => (prev.size === 0 ? prev : new Map()))
            setPosterSeed((s) => s + 1)
          }}
          title={uiText.toolbar.regenerateTitle}
        >
          ↻ {uiText.toolbar.regenerate}
        </button>
        <button
          type="button"
          className="bento-toolbar__btn"
          onClick={handleDownloadPdf}
          disabled={isLoadingSnapshot}
          title={uiText.toolbar.pdfTitle}
        >
          ⤓ {uiText.toolbar.pdf}
        </button>
        <div className="bento-toolbar__menu" ref={languageMenuRef}>
          <button
            type="button"
            className="bento-toolbar__icon-btn"
            title={uiText.toolbar.language}
            aria-label={uiText.toolbar.languageAria}
            aria-haspopup="menu"
            aria-expanded={isLanguageMenuOpen}
            onClick={() => setIsLanguageMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M3.5 12h17" />
              <path d="M12 3.5c2.3 2.4 3.6 5.4 3.6 8.5S14.3 18.1 12 20.5" />
              <path d="M12 3.5c-2.3 2.4-3.6 5.4-3.6 8.5S9.7 18.1 12 20.5" />
            </svg>
          </button>
          {isLanguageMenuOpen && (
            <div className="bento-toolbar__menu-popover" role="menu" aria-label={uiText.toolbar.language}>
              {UI_LANGUAGES.map((option) => {
                const isActive = option.code === commonNameLanguage
                return (
                  <button
                    key={option.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    className={
                      'bento-toolbar__menu-option' +
                      (isActive ? ' bento-toolbar__menu-option--active' : '')
                    }
                    onClick={() => selectLanguage(option.code)}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
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
              const tileKey = t.slotId ? `slot-${t.slotId}` : `tile-${t.id}`
              const className = t.className + (isLocked ? ' bento-card--locked' : '')
              const style = {
                gridColumn: `${p.x + 1} / span ${p.w}`,
                gridRow: `${p.y + 1} / span ${p.h}`,
              }
              const cardBody = (
                <>
                  {canLock && (
                    <button
                      type="button"
                      className={
                        'bento-lock-btn' + (isLocked ? ' bento-lock-btn--on' : '')
                      }
                      onClick={() => toggleLock(t, { x: p.x, y: p.y })}
                      title={isLocked ? uiText.toolbar.unlockCardTitle : uiText.toolbar.lockCardTitle}
                      aria-label={isLocked ? uiText.toolbar.unlockCard : uiText.toolbar.lockCard}
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
                </>
              )

              return (
                <motion.div
                  key={tileKey}
                  layout={isLocked ? false : 'position'}
                  initial={isLocked ? false : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={isLocked ? undefined : { opacity: 0, scale: 0.92 }}
                  transition={
                    isLocked
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 220, damping: 26 }
                  }
                  className={className}
                  style={style}
                >
                  {cardBody}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
        {isLoadingSnapshot && (
          <div className="bento-grid-loading" role="status" aria-live="polite">
            <Loader size={112} label={uiText.toolbar.loadingSnapshot} />
          </div>
        )}
      </div>
    </div>
  )
}

export default BentoPoster
