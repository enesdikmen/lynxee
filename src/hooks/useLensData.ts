import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchDatasetMetadata,
  fetchOccurrenceFacets,
  fetchSpecies,
} from '../api/gbif'
import {
  ALL_IMAGE_SOURCES,
} from '../api/speciesImage'
import {
  fallbackKingdomBreakdown,
  fallbackSeasonality,
} from '../data/lensFallbacks'
import type {
  DatasetSummary,
  Place,
} from '../types/lens'
import { useConservationSnapshot } from './lensData/conservation'
import { dedupeSpeciesAcrossLenses } from './lensData/dedupe'
import { useLensImageOverlay } from './lensData/imageOverlay'
import { buildRecordsBreakdown } from './lensData/recordsBreakdown'
import { placeGeoParams } from './lensData/shared'
import { useThematicLensData } from './lensData/thematic'
import { useTopSpeciesData } from './lensData/topSpecies'
import { useLiveSignatureSpecies } from './lensData/signatureSpecies'
import type {
  LensData,
  RecordsBreakdownItem,
  UseLensDataOptions,
  YearSummary,
} from './lensData/types'

export type { LensData, RecordsBreakdownItem, UseLensDataOptions } from './lensData/types'

export const useLensData = (
  selectedPlace?: Place,
  options: UseLensDataOptions = {},
): LensData => {
  const enabled = options.enabled ?? true
  const activePlace = enabled ? selectedPlace : undefined
  const imageSources = options.imageSources ?? ALL_IMAGE_SOURCES
  const activeImageSources = enabled ? imageSources : []
  const contentSeed = options.contentSeed ?? 1
  const commonNameLanguage = options.commonNameLanguage ?? 'en'

  const facetsQuery = useQuery({
    queryKey: ['occurrenceFacets', activePlace?.id],
    queryFn: ({ signal }) =>
      fetchOccurrenceFacets({
        ...(activePlace
          ? placeGeoParams(activePlace)
          : { latitude: 0, longitude: 0, radiusKm: 0 }),
        facetFields: [
          'month',
          'year',
          'datasetKey',
          'kingdomKey',
          'basisOfRecord',
        ],
        facetLimit: 300,
        signal,
      }),
    enabled: enabled && Boolean(activePlace),
    staleTime: 1000 * 60 * 10,
  })

  const facetsSummary = useMemo(() => {
    if (!facetsQuery.data) return null

    const normalizeField = (value: string) =>
      value.replace(/_/g, '').toLowerCase()

    const facetsByField = facetsQuery.data.facets.reduce(
      (acc, facet) => {
        acc[normalizeField(facet.field)] = facet
        return acc
      },
      {} as Record<string, { counts: { name: string; count: number }[] }>,
    )

    const getCounts = (field: string) =>
      facetsByField[normalizeField(field)]?.counts ?? []

    return {
      month: getCounts('month'),
      year: getCounts('year'),
      datasetKey: getCounts('datasetKey'),
      kingdomKey: getCounts('kingdomKey'),
      basisOfRecord: getCounts('basisOfRecord'),
    }
  }, [facetsQuery.data])

  const seasonalityData = useMemo(() => {
    if (!facetsSummary?.month?.length) return fallbackSeasonality
    const countsByMonth = facetsSummary.month.reduce<Record<number, number>>(
      (acc, item) => {
        const parsed = Number(item.name)
        if (Number.isFinite(parsed)) acc[parsed] = item.count
        return acc
      },
      {},
    )
    return Array.from({ length: 12 }, (_, index) =>
      countsByMonth[index + 1] ?? 0,
    )
  }, [facetsSummary])

  const yearSummary = useMemo<YearSummary | null>(() => {
    if (!facetsSummary?.year?.length) return null
    const entries = facetsSummary.year
      .map((item) => ({ year: Number(item.name), count: item.count }))
      .filter((e) => Number.isFinite(e.year) && e.year > 0)
      .sort((a, b) => a.year - b.year)
    if (entries.length === 0) return null

    const firstYear = entries[0].year
    const peak = entries.reduce((best, e) => (e.count > best.count ? e : best), entries[0])

    return {
      firstYear,
      peakYear: peak.year,
      peakYearCount: peak.count,
      yearCounts: entries,
    }
  }, [facetsSummary])

  const {
    topSpeciesData,
    isReady: isTopSpeciesReady,
  } = useTopSpeciesData(activePlace, contentSeed, commonNameLanguage)

  const { thematicStripCards, isReady: isThematicReady } = useThematicLensData(
    activePlace,
    contentSeed,
    commonNameLanguage,
  )

  const {
    snapshot: conservationSnapshot,
    isReady: isConservationReady,
  } = useConservationSnapshot(activePlace, contentSeed, commonNameLanguage)

  const kingdomKeys = useMemo(
    () =>
      facetsSummary?.kingdomKey
        ?.map((item) => Number(item.name))
        .filter((value) => Number.isFinite(value))
        .slice(0, 5) ?? [],
    [facetsSummary],
  )

  const taxonLabelsQuery = useQuery({
    queryKey: ['taxonLabels', kingdomKeys],
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(
        kingdomKeys.map(async (key) => {
          const species = await fetchSpecies({ speciesKey: key, signal })
          return [
            key,
            species.canonicalName ?? species.scientificName ?? `Key ${key}`,
          ] as const
        }),
      )
      return Object.fromEntries(entries)
    },
    enabled: kingdomKeys.length > 0,
    staleTime: 1000 * 60 * 60,
  })

  const kingdomBreakdown = useMemo(() => {
    if (!facetsSummary?.kingdomKey?.length) return fallbackKingdomBreakdown
    return facetsSummary.kingdomKey
      .slice(0, 5)
      .map((item) => {
        const key = Number(item.name)
        return {
          label: taxonLabelsQuery.data?.[key] ?? `Key ${item.name}`,
          count: item.count,
        }
      })
  }, [facetsSummary, taxonLabelsQuery.data])

  const datasetKeys = useMemo(() => {
    if (!facetsSummary?.datasetKey?.length) return []
    return facetsSummary.datasetKey
      .slice(0, 5)
      .map((item) => item.name)
  }, [facetsSummary])

  const datasetCountsByKey = useMemo<Record<string, number>>(() => {
    if (!facetsSummary?.datasetKey?.length) return {}
    return Object.fromEntries(
      facetsSummary.datasetKey.map((item) => [item.name, item.count]),
    )
  }, [facetsSummary])

  const datasetQuery = useQuery({
    queryKey: ['topDatasets', datasetKeys],
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        datasetKeys.map((datasetKey) =>
          fetchDatasetMetadata({ datasetKey, signal }),
        ),
      )
      return results
    },
    enabled: datasetKeys.length > 0,
    staleTime: 1000 * 60 * 60,
  })

  const datasetSummaries = useMemo<DatasetSummary[]>(() => {
    return (
      datasetQuery.data
        ?.map((dataset) => ({
          key: dataset.key,
          title: dataset.title,
          occurrenceCount: datasetCountsByKey[dataset.key] ?? 0,
          doi: dataset.doi,
          publisher: dataset.publisher,
          license: dataset.license,
        }))
        .filter((dataset) => dataset.title) ?? []
    )
  }, [datasetQuery.data, datasetCountsByKey])

  const maxSeasonality = useMemo(
    () => Math.max(...seasonalityData, 1),
    [seasonalityData],
  )

  const totalRecords = facetsQuery.data?.count ?? 0

  const recordsBreakdown = useMemo<RecordsBreakdownItem[]>(() => {
    return buildRecordsBreakdown(facetsSummary?.basisOfRecord ?? [], totalRecords)
  }, [facetsSummary, totalRecords])

  const {
    signatureSpeciesData: liveSignatureSpecies,
    isReady: isSignatureReady,
  } = useLiveSignatureSpecies(activePlace, commonNameLanguage)

  const dedupedPools = useMemo(() => {
    return dedupeSpeciesAcrossLenses({
      isReady: false,
      seasonalityData,
      yearSummary,
      topSpeciesData,
      thematicStripCards,
      conservationSnapshot,
      kingdomBreakdown,
      datasetSummaries,
      totalRecords,
      maxSeasonality,
      recordsBreakdown,
      signatureSpeciesData: liveSignatureSpecies,
    })
  }, [
    seasonalityData,
    yearSummary,
    topSpeciesData,
    thematicStripCards,
    conservationSnapshot,
    kingdomBreakdown,
    datasetSummaries,
    totalRecords,
    maxSeasonality,
    recordsBreakdown,
    liveSignatureSpecies,
  ])

  const imaged = useLensImageOverlay({
    topSpeciesData: dedupedPools.topSpeciesData,
    thematicStripCards: dedupedPools.thematicStripCards,
    conservationSnapshot: dedupedPools.conservationSnapshot,
    signatureSpeciesData: dedupedPools.signatureSpeciesData,
    imageSources: activeImageSources,
  })

  const isFacetsReady =
    !activePlace || facetsQuery.isSuccess || facetsQuery.isError
  const isTaxonLabelsReady =
    kingdomKeys.length === 0 || taxonLabelsQuery.isSuccess || taxonLabelsQuery.isError
  const isDatasetsReady =
    datasetKeys.length === 0 || datasetQuery.isSuccess || datasetQuery.isError
  const isReady =
    (!enabled ||
    isFacetsReady &&
    isTopSpeciesReady &&
    isThematicReady &&
    isConservationReady &&
    isTaxonLabelsReady &&
    isDatasetsReady &&
    isSignatureReady &&
    imaged.isReady)

  return {
    ...dedupedPools,
    isReady,
    topSpeciesData: imaged.topSpeciesData,
    thematicStripCards: imaged.thematicStripCards,
    conservationSnapshot: imaged.conservationSnapshot,
    signatureSpeciesData: imaged.signatureSpeciesData,
  }
}
