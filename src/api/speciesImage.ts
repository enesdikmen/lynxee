/**
 * speciesImage — resolve a representative image for a GBIF species using
 * a configurable chain of sources. The resolver tries `sources` in order
 * and returns the first hit (or null).
 *
 * Sources:
 *   - 'wikidata'   : SPARQL P846 (GBIF taxon key) → P18 → Commons thumb.
 *   - 'inaturalist': iNat taxa search → default_photo.medium_url.
 *   - 'gbif'       : /species/{key}/media (first item with url).
 *
 * Cache shape: one Promise per (speciesKey, source) pair, kept for the
 * session. Each fetch runs to completion exactly once; the resolved value
 * (image or null) is the cached outcome — see the resolver section below.
 */
import { fetchSpeciesMedia } from './gbif'

export type ImageSource = 'wikidata' | 'inaturalist' | 'gbif'

export const ALL_IMAGE_SOURCES: ImageSource[] = [
  'inaturalist',
  'wikidata',
  'gbif',
]

export const IMAGE_SOURCE_LABELS: Record<ImageSource, string> = {
  wikidata: 'Wikidata',
  inaturalist: 'iNaturalist',
  gbif: 'GBIF',
}

export interface SpeciesImage {
  /** Best-quality URL for hero/mini tiles (rectangular containers). */
  url: string
  /** Pre-cropped 1:1 thumbnail; falls back to `url` if absent. */
  squareUrl?: string
  source: ImageSource
  author?: string
  license?: string
  licenseUrl?: string
  sourceUrl?: string
}

/** Fetch JSON, swallowing network/parse errors as null so callers can fall through. */
const safeJson = async <T>(
  url: string,
  signal?: AbortSignal,
  init?: RequestInit,
): Promise<T | null> => {
  try {
    const res = await fetch(url, { ...init, signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

const stripHtml = (s?: string) => s?.replace(/<[^>]*>?/gm, '').trim()

const HERO_IMAGE_WIDTH = 1000
const SQUARE_IMAGE_WIDTH = 400

const inatSizedUrl = (input: string, size: 'medium' | 'square') =>
  input.replace(
    /\/(square|small|medium|large|original)\.(jpe?g|png|webp)(?=($|\?))/i,
    `/${size}.$2`,
  )

const wikimediaThumbFromUrl = (input: string, width: number) => {
  try {
    const url = new URL(input)
    if (!url.hostname.endsWith('wikimedia.org')) return null
    const decodedPath = decodeURIComponent(url.pathname)

    const specialFile = decodedPath.match(/\/wiki\/Special:FilePath\/([^?#]+)/)
    if (specialFile?.[1]) return commonsThumb(specialFile[1], width)

    const uploadFile = decodedPath.match(/\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)$/i)
    if (uploadFile?.[1]) return commonsThumb(uploadFile[1], width)
  } catch {
    return null
  }
  return null
}

const hasBoundedImageHint = (input: string) => {
  try {
    const url = new URL(input)
    const width = Number(
      url.searchParams.get('width') ??
        url.searchParams.get('w') ??
        url.searchParams.get('maxwidth'),
    )
    if (Number.isFinite(width) && width > 0 && width <= HERO_IMAGE_WIDTH) return true
    return /\/(square|small|medium|large)\.(jpe?g|png|webp)(?=($|\?))/i.test(
      url.pathname,
    )
  } catch {
    return false
  }
}

const normalizeGbifMediaUrl = (input: string) => {
  const wikimediaHero = wikimediaThumbFromUrl(input, HERO_IMAGE_WIDTH)
  if (wikimediaHero) {
    return {
      url: wikimediaHero,
      squareUrl: wikimediaThumbFromUrl(input, SQUARE_IMAGE_WIDTH) ?? wikimediaHero,
    }
  }

  if (/static\.inaturalist\.org/i.test(input)) {
    return {
      url: inatSizedUrl(input, 'medium'),
      squareUrl: inatSizedUrl(input, 'square'),
    }
  }

  if (hasBoundedImageHint(input)) return { url: input }
  return null
}

// ── Wikidata ──────────────────────────────────────────────────────
// 1) SPARQL P846 (GBIF taxon key) → QID
// 2) Special:EntityData → P18 (image) claim → Commons file name
// 3) Commons API → thumbnail URLs + license metadata

interface SparqlResponse {
  results: { bindings: Array<{ item: { value: string } }> }
}

interface EntityResponse {
  entities: Record<
    string,
    {
      claims?: Record<
        string,
        Array<{ mainsnak: { datavalue?: { value: string } } }>
      >
    }
  >
}

interface CommonsResponse {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: Array<{
          url: string
          extmetadata?: Record<string, { value?: string }>
        }>
      }
    >
  }
}

const commonsThumb = (fileName: string, width: number) =>
  `https://commons.wikimedia.org/w/thumb.php?width=${width}&f=${encodeURIComponent(fileName)}`

const tryWikidata = async (
  speciesKey: number,
  signal?: AbortSignal,
): Promise<SpeciesImage | null> => {
  const sparqlQuery = `SELECT ?item WHERE { ?item wdt:P846 "${speciesKey}" . } LIMIT 1`
  const sparql = await safeJson<SparqlResponse>(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`,
    signal,
    { headers: { Accept: 'application/sparql-results+json' } },
  )
  const qid = sparql?.results?.bindings?.[0]?.item?.value?.split('/').pop()
  if (!qid) return null

  const entity = await safeJson<EntityResponse>(
    `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
    signal,
  )
  const fileName =
    entity?.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  if (!fileName) return null

  const commons = await safeJson<CommonsResponse>(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${fileName}`)}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`,
    signal,
  )
  const info = Object.values(commons?.query?.pages ?? {})[0]?.imageinfo?.[0]
  if (!info) return null
  const meta = info.extmetadata ?? {}

  return {
    // Hero tile is 2×2 — 1000px gives object-fit: cover headroom on big screens.
    url: commonsThumb(fileName, HERO_IMAGE_WIDTH),
    squareUrl: commonsThumb(fileName, SQUARE_IMAGE_WIDTH),
    source: 'wikidata',
    author: stripHtml(meta.Artist?.value),
    license: meta.LicenseShortName?.value,
    licenseUrl: meta.LicenseUrl?.value,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`,
  }
}

// ── iNaturalist ───────────────────────────────────────────────────

interface InatTaxaResponse {
  results: Array<{
    name: string
    default_photo?: {
      id?: number
      medium_url?: string
      url?: string
      square_url?: string
      attribution?: string
      license_code?: string | null
    }
  }>
}

const tryInat = async (
  scientificName: string | undefined,
  signal?: AbortSignal,
): Promise<SpeciesImage | null> => {
  if (!scientificName) return null
  // iNat's `q` is fuzzy and matches common names, so "Lynx lynx" can return
  // "Lynx rufus" (Bobcat). Fetch a handful and require an exact name match.
  const data = await safeJson<InatTaxaResponse>(
    `https://api.inaturalist.org/v1/taxa?per_page=10&rank=species&q=${encodeURIComponent(scientificName)}`,
    signal,
  )
  const target = scientificName.trim().toLowerCase()
  const photo = data?.results?.find(
    (r) => r.name?.trim().toLowerCase() === target,
  )?.default_photo
  // Prefer medium-size assets for rectangular cards and keep the square
  // version for small cropped tiles so PDF exports never embed originals.
  const url = photo?.medium_url || photo?.url || photo?.square_url
  if (!url) return null
  return {
    url: inatSizedUrl(url, 'medium'),
    squareUrl: photo?.square_url ?? inatSizedUrl(url, 'square'),
    source: 'inaturalist',
    author: photo?.attribution,
    license: photo?.license_code || undefined,
    sourceUrl: photo?.id
      ? `https://www.inaturalist.org/photos/${photo.id}`
      : undefined,
  }
}

// ── GBIF ──────────────────────────────────────────────────────────

const tryGbif = async (
  speciesKey: number,
  signal?: AbortSignal,
): Promise<SpeciesImage | null> => {
  try {
    const media = await fetchSpeciesMedia({ speciesKey, limit: 1, signal })
    const item = media.results.find((m) => m.identifier || m.references)
    const rawUrl = item?.identifier || item?.references
    if (!rawUrl) return null
    const image = normalizeGbifMediaUrl(rawUrl)
    if (!image) return null
    return {
      ...image,
      source: 'gbif',
      author: item?.creator || item?.rightsHolder,
      license: item?.license,
      sourceUrl: item?.references || rawUrl,
    }
  } catch {
    return null
  }
}

// ── Resolver ──────────────────────────────────────────────────────
//
// Design: cache one Promise per (speciesKey, source) pair.
// • The promise itself dedupes concurrent callers.
// • Successful hits (non-null) are cached forever and reused instantly
//   when sources are toggled or reordered.
// • `null` outcomes are evicted after resolution so a transient network
//   failure (rate limit, offline blip) doesn't permanently poison a
//   species' image — the next call retries from scratch. This is what
//   lets locked cards on a freshly opened share URL recover their image
//   instead of showing the placeholder forever.
// • We deliberately do NOT accept an external AbortSignal. React Query
//   cancels the parent query on every key change (e.g. toggling a source);
//   if we propagated that, in-flight fetches would be aborted mid-walk and
//   the next render would have nothing cached. By owning the lifetime of
//   each fetch we guarantee every (species, source) pair resolves exactly
//   once per attempt and successful results stick around.

const FETCHERS: Record<
  ImageSource,
  (args: { speciesKey: number; scientificName?: string; signal: AbortSignal }) =>
    Promise<SpeciesImage | null>
> = {
  wikidata: ({ speciesKey, signal }) => tryWikidata(speciesKey, signal),
  inaturalist: ({ scientificName, signal }) => tryInat(scientificName, signal),
  gbif: ({ speciesKey, signal }) => tryGbif(speciesKey, signal),
}

const FETCH_TIMEOUT_MS = 8000

const cache = new Map<number, Map<ImageSource, Promise<SpeciesImage | null>>>()

const fetchOne = (
  source: ImageSource,
  speciesKey: number,
  scientificName: string | undefined,
): Promise<SpeciesImage | null> => {
  let bySource = cache.get(speciesKey)
  if (!bySource) {
    bySource = new Map()
    cache.set(speciesKey, bySource)
  }
  const existing = bySource.get(source)
  if (existing) return existing

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS)
  const promise = FETCHERS[source]({ speciesKey, scientificName, signal: ctl.signal })
    .catch(() => null)
    .finally(() => clearTimeout(timer))
    .then((result) => {
      // Don't poison the cache with transient nulls — evict so the next
      // caller can retry. Successful hits stay cached for the session.
      if (!result?.url) {
        const map = cache.get(speciesKey)
        if (map?.get(source) === promise) {
          map.delete(source)
          if (map.size === 0) cache.delete(speciesKey)
        }
      }
      return result
    })

  bySource.set(source, promise)
  return promise
}

interface ResolveArgs {
  speciesKey: number
  scientificName?: string
  /** Active sources in priority order. First hit wins. */
  sources: ImageSource[]
}

/** Walk `sources` in order; return the first source that yields an image,
 *  or `null` if none do. Repeated calls with the same species are cheap. */
export const resolveSpeciesImage = async (
  args: ResolveArgs,
): Promise<SpeciesImage | null> => {
  for (const source of args.sources) {
    const result = await fetchOne(source, args.speciesKey, args.scientificName)
    if (result?.url) return result
  }
  return null
}
