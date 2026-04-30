/**
 * speciesImage — resolve a representative image for a GBIF species using
 * a configurable chain of sources. Each source can be enabled/disabled
 * independently from the UI; the resolver tries enabled sources in the
 * order they appear in `sources` and returns the first hit.
 *
 * Sources:
 *   - 'wikidata'   : SPARQL P846 (GBIF taxon key) → P18 → Commons thumb.
 *   - 'inaturalist': iNat taxa search → default_photo.medium_url.
 *   - 'gbif'       : /species/{key}/media (first item with url).
 *
 * Results are cached in-memory by speciesKey for the session.
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
  source: ImageSource | 'placeholder'
  author?: string
  license?: string
  licenseUrl?: string
  sourceUrl?: string
}

const PLACEHOLDER: SpeciesImage = {
  url: 'https://placehold.co/320x220/f3f4f6/1f2937?text=No+image',
  source: 'placeholder',
}

const cache = new Map<number, Promise<SpeciesImage>>()

interface ResolveArgs {
  speciesKey: number
  scientificName?: string
  sources: ImageSource[]
  signal?: AbortSignal
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
  const url = photo?.medium_url || photo?.url
  if (!url) return null
  return {
    url,
    squareUrl: photo?.square_url,
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

const RESOLVERS: Record<
  ImageSource,
  (args: ResolveArgs) => Promise<SpeciesImage | null>
> = {
  wikidata: ({ speciesKey, signal }) => tryWikidata(speciesKey, signal),
  inaturalist: ({ scientificName, signal }) => tryInat(scientificName, signal),
  gbif: ({ speciesKey, signal }) => tryGbif(speciesKey, signal),
}

const resolveOnce = async (args: ResolveArgs): Promise<SpeciesImage> => {
  for (const source of args.sources) {
    const result = await RESOLVERS[source](args)
    if (result?.url) return result
  }
  return PLACEHOLDER
}

/**
 * Resolve a species image with the configured fallback chain.
 * Cached by speciesKey; toggling sources should call clearSpeciesImageCache.
 */
export const resolveSpeciesImage = (
  args: ResolveArgs,
): Promise<SpeciesImage> => {
  const cached = cache.get(args.speciesKey)
  if (cached) return cached
  const promise = resolveOnce(args).catch((): SpeciesImage => PLACEHOLDER)
  cache.set(args.speciesKey, promise)
  return promise
}

export const clearSpeciesImageCache = () => cache.clear()
