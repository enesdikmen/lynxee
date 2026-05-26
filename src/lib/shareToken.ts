/**
 * Share token encodes the minimum state needed to reproduce a poster
 * (place + poster seed) as one URL param.
 *
 * Current format (compact):
 * - Known fallback city:    k.<seed36>.<index36>
 * - Custom searched city:   c.<seed36>.<lat>.<lon>.<r10>.<bbox|_>.<nameB64>
 *   where lat/lon/bbox are signed base36 ints scaled by 1e4, r10 is
 *   radiusKm scaled by 10, and nameB64 is base64url(city short name).
 *
 * Both sides MUST run `canonicalizePlace` on the Place before using it,
 * so that `place.id` and `place.label` are stable functions of the
 * encoded fields (these values feed several seeded RNG keys).
 *
 */
import type { Place, PlaceBBox } from '../types/lens'
import { places } from '../data/lensFallbacks'

export type ShareState = { place: Place; seed: number }

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
  const lat = Math.round(place.latitude * SCALE)
  const lon = Math.round(place.longitude * SCALE)
  const r10 = Math.max(1, Math.round(place.radiusKm * RADIUS_SCALE))
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
  return {
    ...place,
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
  return `c.${safeSeed.toString(36)}.${lat}.${lon}.${r10}.${bbox}.${nameB64}`
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
  // - current: c.<seed36>.<lat>.<lon>.<r10>.<bbox|_>.<nameB64>
  // - accepted legacy compact variant: c.<seed36>.<lat>.<lon>.<r10>.<bbox|_>
  if (token.startsWith('c.')) {
    const parts = token.split('.')
    if (!(parts.length === 6 || parts.length === 7)) return null
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
    if (parts.length === 7) {
      try {
        label = fromB64Utf8(parts[6])
      } catch {
        label = ''
      }
    }
    const latitude = latI / SCALE
    const longitude = lonI / SCALE
    const radiusKm = Math.max(1, r10 / RADIUS_SCALE)
    const place = canonicalizePlace({
      id: 'tmp',
      label,
      country: '',
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

/**
 * Update the `?s=...` param in the address bar without adding to history.
 * Safe to call frequently — it diff-checks before touching history.
 */
export function syncShareToLocation(place: Place, seed: number): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const token = encodeShare(place, seed)
  if (url.searchParams.get('s') === token) return
  url.searchParams.set('s', token)
  window.history.replaceState(null, '', url.toString())
}
