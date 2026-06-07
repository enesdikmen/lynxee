/**
 * Share token encodes the minimum state needed to reproduce a poster
 * (place + poster seed) as one URL param.
 *
 * Current format (compact):
 * - Known fallback city:    k.<seed36>.<index36>
 * - Custom searched city:   c.<seed36>.<lat>.<lon>.<r10>.<bbox|_>.<nameB64>[.<cc>]
 *   where lat/lon/bbox are signed base36 ints scaled by 1e4, r10 is
 *   radiusKm scaled by 10, nameB64 is base64url(city short name), and
 *   cc is optional uppercase ISO-2 country code.
 *
 * Both sides MUST run `canonicalizePlace` on the Place before using it,
 * so that `place.id` and `place.label` are stable functions of the
 * encoded fields (these values feed several seeded RNG keys).
 *
 */
import type { Place, PlaceBBox } from '../types/lens'
import { places } from '../data/lensFallbacks'

export type ShareState = { place: Place; seed: number }

/** One lock entry as it travels through the URL. The `tile` itself is
 *  rebuilt at runtime from `captureSeed`, so only this minimum is stored. */
export type LockEntry = {
  slotId: string
  x: number
  y: number
  /** `posterSeed` value at the moment of locking. Used to reproduce the
   *  exact content snapshot when the URL is reopened. Each lock carries
   *  its own seed so a poster that has been "regenerate-around-locks"-ed
   *  multiple times can mix snapshots from different seeds. */
  captureSeed: number
}

/** Decoded lock list. `present=false` means the URL had no `l=` param
 *  (apply defaults). `present=true` with an empty list means the user
 *  explicitly cleared all locks. */
export type LockListState = {
  present: boolean
  locks: LockEntry[]
}

const SCALE = 10000
const RADIUS_SCALE = 10

const KNOWN_BY_ID = new Map(places.map((p, i) => [p.id, i]))

/**
 * Return a Place whose `id`/`label` are stable functions of coordinates,
 * radius, and the short city name. Known fallback cities are returned
 * untouched so their hand-written ids and labels are preserved.
 */
export function canonicalizePlace(place: Place): Place {
  if (KNOWN_BY_ID.has(place.id)) return place
  const shortName = (place.label ?? '').split(',')[0]?.trim() ?? ''
  const countryCode = (place.countryCode ?? '').trim().toUpperCase()
  const normalizedCountryCode = /^[A-Z]{2}$/.test(countryCode)
    ? countryCode
    : undefined
  const lat = Math.round(place.latitude * SCALE)
  const lon = Math.round(place.longitude * SCALE)
  const r10 = Math.max(1, Math.round(place.radiusKm * RADIUS_SCALE))
  const quantizedBbox = place.bbox
    ? {
        minLat: Math.round(place.bbox.minLat * SCALE) / SCALE,
        maxLat: Math.round(place.bbox.maxLat * SCALE) / SCALE,
        minLon: Math.round(place.bbox.minLon * SCALE) / SCALE,
        maxLon: Math.round(place.bbox.maxLon * SCALE) / SCALE,
      }
    : undefined
  const slug = shortName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  const id = `s-${slug || 'p'}-${lat.toString(36)}-${lon.toString(36)}-${r10.toString(36)}`
  const label =
    shortName || `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`

  // Keep runtime geometry on the same precision grid as `encodeShare`.
  // This makes the first tab use exactly the same Place geometry that
  // a reopened tab reconstructs from the URL token.
  return {
    ...place,
    latitude: lat / SCALE,
    longitude: lon / SCALE,
    radiusKm: r10 / RADIUS_SCALE,
    ...(normalizedCountryCode ? { countryCode: normalizedCountryCode } : {}),
    ...(quantizedBbox ? { bbox: quantizedBbox } : {}),
    id,
    label,
  }
}

function toB64Utf8(s: string): string {
  const b64 = btoa(unescape(encodeURIComponent(s)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Utf8(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return decodeURIComponent(escape(atob(b64)))
}

function encSignedInt(n: number): string {
  const i = Math.trunc(n)
  if (i < 0) return `-${Math.abs(i).toString(36)}`
  return i.toString(36)
}

function decSignedInt(s: string): number | null {
  if (!s) return null
  if (s.startsWith('-')) {
    const v = Number.parseInt(s.slice(1), 36)
    return Number.isFinite(v) ? -v : null
  }
  const v = Number.parseInt(s, 36)
  return Number.isFinite(v) ? v : null
}

export function encodeShare(place: Place, seed: number): string {
  const idx = KNOWN_BY_ID.get(place.id)
  const safeSeed = Number.isFinite(seed) ? Math.max(1, Math.trunc(seed)) : 1
  if (idx !== undefined) {
    return `k.${safeSeed.toString(36)}.${idx.toString(36)}`
  }

  const lat = encSignedInt(Math.round(place.latitude * SCALE))
  const lon = encSignedInt(Math.round(place.longitude * SCALE))
  const r10 = Math.max(1, Math.round(place.radiusKm * RADIUS_SCALE)).toString(36)
  const bbox = place.bbox
    ? [
        encSignedInt(Math.round(place.bbox.minLat * SCALE)),
        encSignedInt(Math.round(place.bbox.maxLat * SCALE)),
        encSignedInt(Math.round(place.bbox.minLon * SCALE)),
        encSignedInt(Math.round(place.bbox.maxLon * SCALE)),
      ].join('_')
    : '_'
  const shortName = (place.label ?? '').split(',')[0]?.trim() ?? ''
  const nameB64 = toB64Utf8(shortName)
  const countryCode = (place.countryCode ?? '').trim().toUpperCase()
  const ccPart = /^[A-Z]{2}$/.test(countryCode) ? `.${countryCode}` : ''
  return `c.${safeSeed.toString(36)}.${lat}.${lon}.${r10}.${bbox}.${nameB64}${ccPart}`
}

export function decodeShare(token: string): ShareState | null {
  if (!token) return null

  // Compact known-city token: k.<seed36>.<index36>
  if (token.startsWith('k.')) {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const seed = Number.parseInt(parts[1], 36)
    const idx = Number.parseInt(parts[2], 36)
    if (!Number.isFinite(seed) || !Number.isFinite(idx) || !places[idx]) return null
    return {
      place: places[idx],
      seed: Math.max(1, Math.trunc(seed)),
    }
  }

  // Compact custom-city token:
  // - current: c.<seed36>.<lat>.<lon>.<r10>.<bbox|_>.<nameB64>[.<cc>]
  // - accepted legacy compact variant: c.<seed36>.<lat>.<lon>.<r10>.<bbox|_>
  if (token.startsWith('c.')) {
    const parts = token.split('.')
    if (!(parts.length === 6 || parts.length === 7 || parts.length === 8)) return null
    const seed = Number.parseInt(parts[1], 36)
    const latI = decSignedInt(parts[2])
    const lonI = decSignedInt(parts[3])
    const r10 = Number.parseInt(parts[4], 36)
    if (
      !Number.isFinite(seed) ||
      latI === null ||
      lonI === null ||
      !Number.isFinite(r10)
    ) {
      return null
    }
    let bbox: PlaceBBox | undefined
    if (parts[5] !== '_') {
      const bp = parts[5].split('_')
      if (bp.length !== 4) return null
      const b0 = decSignedInt(bp[0])
      const b1 = decSignedInt(bp[1])
      const b2 = decSignedInt(bp[2])
      const b3 = decSignedInt(bp[3])
      if (b0 === null || b1 === null || b2 === null || b3 === null) return null
      bbox = {
        minLat: b0 / SCALE,
        maxLat: b1 / SCALE,
        minLon: b2 / SCALE,
        maxLon: b3 / SCALE,
      }
    }

    let label = ''
    if (parts.length >= 7) {
      try {
        label = fromB64Utf8(parts[6])
      } catch {
        label = ''
      }
    }

    const rawCountryCode = parts.length === 8 ? parts[7].trim().toUpperCase() : ''
    const countryCode = /^[A-Z]{2}$/.test(rawCountryCode)
      ? rawCountryCode
      : undefined

    const latitude = latI / SCALE
    const longitude = lonI / SCALE
    const radiusKm = Math.max(1, r10 / RADIUS_SCALE)
    const place = canonicalizePlace({
      id: 'tmp',
      label,
      country: '',
      ...(countryCode ? { countryCode } : {}),
      latitude,
      longitude,
      radiusKm,
      ...(bbox ? { bbox } : {}),
    })

    return {
      place,
      seed: Math.max(1, Math.trunc(seed)),
    }
  }

  return null
}

/** Read the `s` param from the current URL, if any. */
export function readShareFromLocation(): ShareState | null {
  if (typeof window === 'undefined') return null
  const token = new URL(window.location.href).searchParams.get('s')
  return token ? decodeShare(token) : null
}

/** Read the `lang` param from the current URL, if any. */
export function readLanguageFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const raw = new URL(window.location.href).searchParams.get('lang')
  if (!raw) return null
  return raw.trim().toLowerCase()
}

/** Read the `theme` param from the current URL, if any. */
export function readThemeFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const raw = new URL(window.location.href).searchParams.get('theme')
  if (!raw) return null
  return raw.trim().toLowerCase()
}

/**
 * Encode the lock list as a single compact `l=` param.
 *
 * Format: `<slotId>_<x36>_<y36>_<captureSeed36>,...`
 * - slot ids only contain `[a-zA-Z0-9-]` so they are URL-safe verbatim.
 * - Field separator `_`, lock separator `,`.
 * - `captureSeed36` is REQUIRED on every entry — each lock fully
 *   self-describes the seed it was captured at so the URL is a
 *   round-trip fixed point regardless of how many distinct seeds the
 *   locks span.
 * - An empty `l=` value (no entries) means "user has explicitly cleared
 *   all locks"; absent `l=` param means "apply defaults".
 */
export function encodeLocks(locks: LockEntry[]): string {
  return locks
    .filter(
      (l) =>
        /^[A-Za-z0-9-]+$/.test(l.slotId) &&
        Number.isFinite(l.captureSeed) &&
        l.captureSeed > 0,
    )
    .map(
      (l) =>
        `${l.slotId}_${Math.max(0, Math.trunc(l.x)).toString(36)}_${Math.max(
          0,
          Math.trunc(l.y),
        ).toString(36)}_${Math.max(1, Math.trunc(l.captureSeed)).toString(36)}`,
    )
    .join(',')
}

export function decodeLocks(raw: string): LockListState {
  if (raw === '') return { present: true, locks: [] }
  const locks: LockEntry[] = []
  for (const part of raw.split(',')) {
    const fields = part.split('_')
    if (fields.length !== 4) continue
    const slotId = fields[0]
    if (!/^[A-Za-z0-9-]+$/.test(slotId)) continue
    const x = Number.parseInt(fields[1], 36)
    const y = Number.parseInt(fields[2], 36)
    const captureSeed = Number.parseInt(fields[3], 36)
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(captureSeed) ||
      captureSeed <= 0
    ) {
      continue
    }
    locks.push({ slotId, x, y, captureSeed })
  }
  return { present: true, locks }
}

/** Read `l=` from the current URL. */
export function readLocksFromLocation(): LockListState {
  if (typeof window === 'undefined') return { present: false, locks: [] }
  const url = new URL(window.location.href)
  const raw = url.searchParams.get('l')
  if (raw === null) return { present: false, locks: [] }
  return decodeLocks(raw)
}

/**
 * Update the `?s=...`, `?l=...`, `?lang=...`, and `?theme=...` params
 * in the address bar without
 * pushing history. Pass `lockState=null`/`undefined` to omit `l=`
 * entirely (caller has no opinion / before defaults applied). Pass a
 * state object with an empty list to record "explicitly no locks".
 */
export function syncShareToLocation(
  place: Place,
  seed: number,
  lockState?: { locks: LockEntry[] } | null,
  language = 'en',
  theme = 'playful',
): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const token = encodeShare(place, seed)
  const lToken = lockState ? encodeLocks(lockState.locks) : null
  const langToken = language.trim().toLowerCase() || 'en'
  const themeToken = theme.trim().toLowerCase() || 'playful'

  const curSToken = url.searchParams.get('s')
  const curLToken = url.searchParams.get('l')
  const curLangToken = (url.searchParams.get('lang') ?? 'en').trim().toLowerCase()
  const curThemeToken = (url.searchParams.get('theme') ?? 'playful').trim().toLowerCase()
  if (
    curSToken === token &&
    (curLToken ?? null) === lToken &&
    curLangToken === langToken &&
    curThemeToken === themeToken
  ) return

  url.searchParams.set('s', token)
  if (lToken !== null) url.searchParams.set('l', lToken)
  else url.searchParams.delete('l')
  url.searchParams.set('lang', langToken)
  url.searchParams.set('theme', themeToken)
  // Clean up the legacy unlock-mask param if a previous version wrote it.
  url.searchParams.delete('u')
  window.history.replaceState(null, '', url.toString())
}
