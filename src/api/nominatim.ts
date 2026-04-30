/**
 * Nominatim (OpenStreetMap) city search.
 *
 * Free public endpoint — no API key. Usage policy:
 *   https://operations.osmfoundation.org/policies/nominatim/
 * - max 1 req/sec, debounce on the caller side
 * - send a Referer (browsers do this automatically)
 * - attribute "© OpenStreetMap contributors" if you display results
 *
 * Returns Place objects carrying the admin bounding box (`bbox`), which the
 * rest of the app uses as the "whole city area" geo filter against GBIF.
 */
import type { Place, PlaceBBox } from '../types/lens'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

interface NominatimSearchResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
  name?: string
  type?: string
  class?: string
  boundingbox?: [string, string, string, string] // [south, north, west, east]
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    state?: string
    country?: string
    country_code?: string
  }
}

export interface SearchCitiesOptions {
  signal?: AbortSignal
  limit?: number
  language?: string
}

export async function searchCities(
  query: string,
  { signal, limit = 6, language = 'en' }: SearchCitiesOptions = {},
): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const url = new URL(`${NOMINATIM_BASE}/search`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', language)
  url.searchParams.set('featuretype', 'city')

  const res = await fetch(url.toString(), {
    signal,
    headers: { 'Accept-Language': language },
  })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = (await res.json()) as NominatimSearchResult[]

  return data.map(toPlace)
}

function toPlace(r: NominatimSearchResult): Place {
  const a = r.address ?? {}
  const cityName =
    a.city || a.town || a.village || a.municipality || r.name || r.display_name.split(',')[0].trim()
  const country = a.country ?? ''
  const cc = (a.country_code ?? '').toUpperCase()
  const label = cc ? `${cityName}, ${cc}` : cityName

  let bbox: PlaceBBox | undefined
  if (r.boundingbox && r.boundingbox.length === 4) {
    const [s, n, w, e] = r.boundingbox.map(parseFloat)
    if ([s, n, w, e].every(Number.isFinite)) {
      bbox = { minLat: s, maxLat: n, minLon: w, maxLon: e }
    }
  }

  return {
    id: `osm-${r.place_id}`,
    label,
    country,
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
    radiusKm: 35,
    bbox,
  }
}
