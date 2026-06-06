const GBIF_BASE_URL = 'https://api.gbif.org/v1'
const GBIF_MAX_CONCURRENT_REQUESTS = 6
const GBIF_MAX_429_RETRIES = 3
const GBIF_RETRY_BACKOFF_MS = 1000

let gbifInFlight = 0
const gbifQueue: Array<() => void> = []

const createAbortError = () =>
	new DOMException('The operation was aborted.', 'AbortError')

const wait = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		if (ms <= 0) {
			resolve()
			return
		}

		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort)
			resolve()
		}, ms)

		const onAbort = () => {
			clearTimeout(timer)
			signal?.removeEventListener('abort', onAbort)
			reject(createAbortError())
		}

		signal?.addEventListener('abort', onAbort, { once: true })
	})

const parseRetryAfterMs = (value: string | null) => {
	if (!value) return null

	const asSeconds = Number(value)
	if (Number.isFinite(asSeconds)) return Math.max(0, asSeconds * 1000)

	const asDate = Date.parse(value)
	if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now())

	return null
}

const acquireGbifSlot = async (signal?: AbortSignal) => {
	if (signal?.aborted) throw createAbortError()

	if (gbifInFlight < GBIF_MAX_CONCURRENT_REQUESTS) {
		gbifInFlight += 1
		return
	}

	await new Promise<void>((resolve, reject) => {
		const start = () => {
			signal?.removeEventListener('abort', onAbort)
			gbifInFlight += 1
			resolve()
		}

		const onAbort = () => {
			const idx = gbifQueue.indexOf(start)
			if (idx >= 0) gbifQueue.splice(idx, 1)
			signal?.removeEventListener('abort', onAbort)
			reject(createAbortError())
		}

		gbifQueue.push(start)
		signal?.addEventListener('abort', onAbort, { once: true })
	})
}

const releaseGbifSlot = () => {
	gbifInFlight = Math.max(0, gbifInFlight - 1)
	const next = gbifQueue.shift()
	if (next) next()
}

// Metadata endpoints are highly reusable across lenses. Keep a small in-memory
// cache and in-flight registry so concurrent hooks share one network request.
const speciesCache = new Map<string, GbifSpecies>()
const speciesInFlight = new Map<string, Promise<GbifSpecies>>()

const datasetCache = new Map<string, GbifDataset>()
const datasetInFlight = new Map<string, Promise<GbifDataset>>()

const OCCURRENCE_FACET_CACHE_TTL_MS = 1000 * 60 * 30
const occurrenceFacetCache = new Map<
	string,
	{ data: OccurrenceFacetResponse; expiresAt: number }
>()
const occurrenceFacetInFlight = new Map<string, Promise<OccurrenceFacetResponse>>()

const raceWithSignal = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
	if (!signal) return promise
	if (signal.aborted) return Promise.reject(createAbortError())

	return new Promise<T>((resolve, reject) => {
		const onAbort = () => {
			signal.removeEventListener('abort', onAbort)
			reject(createAbortError())
		}

		signal.addEventListener('abort', onAbort, { once: true })
		promise.then(
			(value) => {
				signal.removeEventListener('abort', onAbort)
				resolve(value)
			},
			(error) => {
				signal.removeEventListener('abort', onAbort)
				reject(error)
			},
		)
	})
}

export type FacetField =
	| 'month'
	| 'year'
	| 'speciesKey'
	| 'kingdomKey'
	| 'classKey'
	| 'datasetKey'
	| 'country'
	| 'basisOfRecord'
	| 'mediaType'
	| 'iucnRedListCategory'

export interface OccurrenceFacetCount {
	name: string
	count: number
}

export interface OccurrenceFacet {
	field: string
	counts: OccurrenceFacetCount[]
}

export interface OccurrenceFacetResponse {
	count: number
	offset: number
	limit: number
	endOfRecords: boolean
	results: []
	facets: OccurrenceFacet[]
}

export interface GbifSpecies {
	key: number
	scientificName: string
	canonicalName?: string
	vernacularName?: string
	rank?: string
	kingdom?: string
	phylum?: string
	class?: string
	order?: string
	family?: string
	genus?: string
	species?: string
}

export interface GbifMediaItem {
	identifier?: string
	references?: string
	title?: string
	type?: string
	license?: string
	rightsHolder?: string
	creator?: string
}

export interface GbifMediaResponse {
	offset: number
	limit: number
	endOfRecords: boolean
	results: GbifMediaItem[]
}

export interface GbifDataset {
	key: string
	title: string
	doi?: string
	description?: string
	publisher?: string
	license?: string
	citation?: {
		text?: string
	}
}

interface RequestOptions {
	signal?: AbortSignal
	headers?: HeadersInit
}

export interface OccurrenceFacetRequest extends RequestOptions {
	latitude: number
	longitude: number
	radiusKm?: number
	/** Real bounding box (preferred over radiusKm when set). */
	bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
	/** ISO-2 country code for country-scale searches. */
	countryCode?: string
	facetFields: FacetField[]
	facetLimit?: number
	facetOffset?: number
	classKey?: number | number[]
	kingdomKey?: number | number[]
	orderKey?: number | number[]
	familyKey?: number | number[]
	speciesKey?: number | number[]
	mediaType?: string | string[]
	iucnRedListCategory?: string | string[]
	month?: number | number[]
	year?: number | number[] | string
}

export interface SpeciesRequest extends RequestOptions {
	speciesKey: number
	language?: string
}

export interface SpeciesMediaRequest extends RequestOptions {
	speciesKey: number
	limit?: number
	offset?: number
}

export interface DatasetRequest extends RequestOptions {
	datasetKey: string
}

// GBIF occurrence search supports bounding boxes; approximate a radius with lat/lon deltas.
const toBounds = (latitude: number, longitude: number, radiusKm: number) => {
	const kmPerDegLat = 110.574
	const kmPerDegLon = 111.32 * Math.cos((latitude * Math.PI) / 180)

	const latDelta = radiusKm / kmPerDegLat
	const lonDelta = radiusKm / kmPerDegLon

	const minLat = Math.max(-90, latitude - latDelta)
	const maxLat = Math.min(90, latitude + latDelta)
	const minLon = Math.max(-180, longitude - lonDelta)
	const maxLon = Math.min(180, longitude + lonDelta)

	return { minLat, maxLat, minLon, maxLon }
}

const buildUrl = (
	endpoint: string,
	params: Record<string, string | number | Array<string | number> | undefined>,
) => {
	const url = new URL(`${GBIF_BASE_URL}${endpoint}`)

	Object.entries(params).forEach(([key, value]) => {
		if (value === undefined) return
		if (Array.isArray(value)) {
			value.forEach((item) => url.searchParams.append(key, String(item)))
			return
		}
		url.searchParams.set(key, String(value))
	})

	return url.toString()
}

const normalizeLanguage = (language?: string) =>
	(language ?? '').trim().toLowerCase()

const normalizeCountryCode = (countryCode?: string) => {
	const cc = (countryCode ?? '').trim().toUpperCase()
	return /^[A-Z]{2}$/.test(cc) ? cc : null
}

const isCountryScaleBBox = (
	bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | undefined,
) => {
	if (!bbox) return false
	const latSpan = Math.abs(bbox.maxLat - bbox.minLat)
	const lonSpan = Math.abs(bbox.maxLon - bbox.minLon)
	return latSpan >= 20 || lonSpan >= 40
}

// Centralized JSON fetch so we keep error messages consistent for UI + debugging.
const fetchJson = async <T>(url: string, options: RequestOptions = {}) => {
	await acquireGbifSlot(options.signal)

	try {
		for (let attempt = 0; attempt <= GBIF_MAX_429_RETRIES; attempt++) {
			if (options.signal?.aborted) throw createAbortError()

			const response = await fetch(url, {
				signal: options.signal,
				headers: options.headers,
			})

			if (response.ok) {
				return (await response.json()) as T
			}

			if (response.status === 429 && attempt < GBIF_MAX_429_RETRIES) {
				const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'))
				const waitMs = retryAfterMs ?? GBIF_RETRY_BACKOFF_MS * (attempt + 1)
				await wait(waitMs, options.signal)
				continue
			}

			throw new Error(`GBIF request failed (${response.status}) for ${url}`)
		}

		throw new Error(`GBIF request failed (429) for ${url}`)
	} finally {
		releaseGbifSlot()
	}
}

export const fetchOccurrenceFacets = async ({
	latitude,
	longitude,
	radiusKm = 35,
	bbox,
	countryCode,
	facetFields,
	facetLimit = 10,
	facetOffset,
	classKey,
	kingdomKey,
	orderKey,
	familyKey,
	speciesKey,
	mediaType,
	iucnRedListCategory,
	month,
	year,
	signal,
}: OccurrenceFacetRequest) => {
	const normalizedCountryCode = normalizeCountryCode(countryCode)
	const useCountryFilter = Boolean(normalizedCountryCode && isCountryScaleBBox(bbox))

	// Geometry: prefer the real bbox from Nominatim, else fall back to a
	// bbox derived from radiusKm.
	const b = bbox ?? toBounds(latitude, longitude, radiusKm)

	const url = buildUrl('/occurrence/search', {
		limit: 0,
		// Using facets with limit=0 keeps payloads small while still returning summary counts.
		decimalLatitude: useCountryFilter ? undefined : `${b.minLat},${b.maxLat}`,
		decimalLongitude: useCountryFilter ? undefined : `${b.minLon},${b.maxLon}`,
		country: useCountryFilter ? normalizedCountryCode ?? undefined : undefined,
		classKey,
		kingdomKey,
		orderKey,
		familyKey,
		speciesKey,
		mediaType,
		iucnRedListCategory,
		month,
		year,
		facet: facetFields,
		facetLimit,
		facetOffset,
	})

	const now = Date.now()
	const cached = occurrenceFacetCache.get(url)
	if (cached && cached.expiresAt > now) {
		return raceWithSignal(Promise.resolve(cached.data), signal)
	}
	if (cached) occurrenceFacetCache.delete(url)

	const existing = occurrenceFacetInFlight.get(url)
	if (existing) return raceWithSignal(existing, signal)

	const request = fetchJson<OccurrenceFacetResponse>(url)
		.then((result) => {
			occurrenceFacetCache.set(url, {
				data: result,
				expiresAt: Date.now() + OCCURRENCE_FACET_CACHE_TTL_MS,
			})
			return result
		})
		.finally(() => {
			occurrenceFacetInFlight.delete(url)
		})

	occurrenceFacetInFlight.set(url, request)
	return raceWithSignal(request, signal)
}

export const fetchSpecies = async ({ speciesKey, signal, language }: SpeciesRequest) => {
	const normalizedLanguage = normalizeLanguage(language)
	const cacheKey = `${speciesKey}:${normalizedLanguage || 'default'}`
	const cached = speciesCache.get(cacheKey)
	if (cached) return raceWithSignal(Promise.resolve(cached), signal)

	const existing = speciesInFlight.get(cacheKey)
	if (existing) return raceWithSignal(existing, signal)

	const url = buildUrl(`/species/${speciesKey}`, {})
	const request = fetchJson<GbifSpecies>(url, {
		headers: normalizedLanguage
			? { 'Accept-Language': normalizedLanguage }
			: undefined,
	})
		.then((result) => {
			speciesCache.set(cacheKey, result)
			return result
		})
		.finally(() => {
			speciesInFlight.delete(cacheKey)
		})

	speciesInFlight.set(cacheKey, request)
	return raceWithSignal(request, signal)
}

export const fetchSpeciesMedia = async ({
	speciesKey,
	limit = 8,
	offset = 0,
	signal,
}: SpeciesMediaRequest) => {
	const url = buildUrl(`/species/${speciesKey}/media`, { limit, offset })
	return fetchJson<GbifMediaResponse>(url, { signal })
}

export const fetchDatasetMetadata = async ({
	datasetKey,
	signal,
}: DatasetRequest) => {
	const cached = datasetCache.get(datasetKey)
	if (cached) return raceWithSignal(Promise.resolve(cached), signal)

	const existing = datasetInFlight.get(datasetKey)
	if (existing) return raceWithSignal(existing, signal)

	const url = buildUrl(`/dataset/${datasetKey}`, {})
	const request = fetchJson<GbifDataset>(url)
		.then((result) => {
			datasetCache.set(datasetKey, result)
			return result
		})
		.finally(() => {
			datasetInFlight.delete(datasetKey)
		})

	datasetInFlight.set(datasetKey, request)
	return raceWithSignal(request, signal)
}

export { GBIF_BASE_URL }
