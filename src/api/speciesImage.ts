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
  'wikidata',
  'inaturalist',
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
    url: commonsThumb(fileName, 1000),
    squareUrl: commonsThumb(fileName, 400),
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
  // Prefer medium-size assets — `square_url` is often too small and looks
  // blurry when cards render larger. The strip falls back to `url` via
  // `squareImageUrl ?? imageUrl` in the consumer, so we don't set squareUrl.
  const url = photo?.medium_url || photo?.url || photo?.square_url
  if (!url) return null
  return {
    url,
    source: 'inaturalist',
    author: photo?.attribution,
    license: photo?.license_code || undefined,
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
    const url = item?.identifier || item?.references
    if (!url) return null
    return {
      url,
      source: 'gbif',
      author: item?.creator || item?.rightsHolder,
      license: item?.license,
    }
  } catch {
    return null
  }
}

// ── Resolver ──────────────────────────────────────────────────────
//
// Design: cache one Promise per (speciesKey, source) pair, forever.
// • The promise itself dedupes concurrent callers.
// • The resolved value (image or null) is the cached outcome — so a source
//   that returned no image is never retried, and a successful hit is reused
//   instantly when sources are toggled or reordered.
// • We deliberately do NOT accept an external AbortSignal. React Query
//   cancels the parent query on every key change (e.g. toggling a source);
//   if we propagated that, in-flight fetches would be aborted mid-walk and
//   the next render would have nothing cached. By owning the lifetime of
//   each fetch we guarantee every (species, source) pair resolves exactly
//   once and the result sticks around.

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
