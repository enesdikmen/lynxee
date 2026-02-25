const GBIF_BASE_URL = 'https://api.gbif.org/v1'

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
}

export interface OccurrenceFacetRequest extends RequestOptions {
	latitude: number
	longitude: number
	radiusKm?: number
	facetFields: FacetField[]
	facetLimit?: number
}

export interface SpeciesRequest extends RequestOptions {
	speciesKey: number
}

export interface SpeciesMediaRequest extends RequestOptions {
	speciesKey: number
	limit?: number
	offset?: number
}

export interface DatasetRequest extends RequestOptions {
	datasetKey: string
}

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

const fetchJson = async <T>(url: string, options: RequestOptions = {}) => {
	const response = await fetch(url, { signal: options.signal })

	if (!response.ok) {
		throw new Error(`GBIF request failed (${response.status}) for ${url}`)
	}

	return (await response.json()) as T
}

export const fetchOccurrenceFacets = async ({
	latitude,
	longitude,
	radiusKm = 35,
	facetFields,
	facetLimit = 10,
	signal,
}: OccurrenceFacetRequest) => {
	const bounds = toBounds(latitude, longitude, radiusKm)

	const url = buildUrl('/occurrence/search', {
		limit: 0,
		decimalLatitude: `${bounds.minLat},${bounds.maxLat}`,
		decimalLongitude: `${bounds.minLon},${bounds.maxLon}`,
		facet: facetFields,
		facetLimit,
	})

	return fetchJson<OccurrenceFacetResponse>(url, { signal })
}

export const fetchSpecies = async ({ speciesKey, signal }: SpeciesRequest) => {
	const url = buildUrl(`/species/${speciesKey}`, {})
	return fetchJson<GbifSpecies>(url, { signal })
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
	const url = buildUrl(`/dataset/${datasetKey}`, {})
	return fetchJson<GbifDataset>(url, { signal })
}

export { GBIF_BASE_URL }
