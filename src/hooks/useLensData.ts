import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchDatasetMetadata,
  fetchOccurrenceFacets,
  fetchSpecies,
  fetchSpeciesMedia,
} from '../api/gbif'
import {
  IUCN_LABELS,
  fallbackClassBreakdown,
  fallbackIucnSummary,
  fallbackKingdomBreakdown,
  fallbackSeasonality,
  fallbackTopSpecies,
  fallbackYearTrend,
} from '../data/lensFallbacks'
import type {
  BreakdownItem,
  IucnStatus,
  Place,
  SpeciesCard,
  YearTrendPoint,
} from '../types/lens'

export type LensData = {
  seasonalityData: number[]
  yearTrendData: YearTrendPoint[]
  topSpeciesData: SpeciesCard[]
  iucnSummaryData: IucnStatus[]
  kingdomBreakdown: BreakdownItem[]
  classBreakdown: BreakdownItem[]
  datasetTitles: string[]
  totalRecords: number
  updatedAt: string
  speciesKeys: number[]
  maxSeasonality: number
  maxTrend: number
  maxKingdom: number
  maxClass: number
}

export const useLensData = (selectedPlace?: Place): LensData => {
  const facetsQuery = useQuery({
    queryKey: ['occurrenceFacets', selectedPlace?.id],
    queryFn: ({ signal }) =>
      fetchOccurrenceFacets({
        latitude: selectedPlace?.latitude ?? 0,
        longitude: selectedPlace?.longitude ?? 0,
        radiusKm: selectedPlace?.radiusKm ?? 0,
        facetFields: [
          'month',
          'year',
          'speciesKey',
          'datasetKey',
          'iucnRedListCategory',
          'kingdomKey',
          'classKey',
        ],
        facetLimit: 12,
        signal,
      }),
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 10,
  })

  const facetsSummary = useMemo(() => {
    if (!facetsQuery.data) return null

    const facetsByField = facetsQuery.data.facets.reduce(
      (acc, facet) => {
        acc[facet.field.toLowerCase()] = facet
        return acc
      },
      {} as Record<string, { counts: { name: string; count: number }[] }>,
    )

    const getCounts = (field: string) =>
      facetsByField[field.toLowerCase()]?.counts ?? []

    return {
      month: getCounts('month'),
      year: getCounts('year'),
      speciesKey: getCounts('speciesKey'),
      datasetKey: getCounts('datasetKey'),
      iucn: getCounts('iucnRedListCategory'),
      kingdomKey: getCounts('kingdomKey'),
      classKey: getCounts('classKey'),
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

  const yearTrendData = useMemo(() => {
    if (!facetsSummary?.year?.length) return fallbackYearTrend
    return facetsSummary.year
      .map((item) => ({
        year: Number(item.name),
        count: item.count,
      }))
      .filter((item) => Number.isFinite(item.year))
      .sort((a, b) => a.year - b.year)
  }, [facetsSummary])

  const speciesKeys = useMemo(() => {
    if (!facetsSummary?.speciesKey?.length) return []
    return facetsSummary.speciesKey
      .map((item) => Number(item.name))
      .filter((value) => Number.isFinite(value))
      .slice(0, 6)
  }, [facetsSummary])

  const topSpeciesQuery = useQuery({
    queryKey: ['topSpecies', speciesKeys],
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        speciesKeys.map(async (speciesKey) => {
          const species = await fetchSpecies({ speciesKey, signal })
          const media = await fetchSpeciesMedia({
            speciesKey,
            limit: 1,
            signal,
          })
          const mediaItem = media.results.find(
            (item) => item.identifier || item.references,
          )
          const imageUrl =
            mediaItem?.identifier ??
            mediaItem?.references ??
            'https://placehold.co/320x220/f3f4f6/1f2937?text=No+image'
          return {
            id: String(speciesKey),
            commonName:
              species.vernacularName ??
              species.canonicalName ??
              species.scientificName,
            scientificName: species.scientificName,
            imageUrl,
            highlight: species.rank
              ? `${species.rank} · ${species.kingdom ?? 'GBIF'}`
              : 'GBIF species',
          }
        }),
      )
      return results
    },
    enabled: speciesKeys.length > 0,
    staleTime: 1000 * 60 * 20,
  })

  const topSpeciesData = topSpeciesQuery.data ?? fallbackTopSpecies

  const iucnSummaryData = useMemo(() => {
    if (!facetsSummary?.iucn?.length) return fallbackIucnSummary
    return facetsSummary.iucn.map((item) => ({
      status: item.name,
      label: IUCN_LABELS[item.name] ?? 'Unknown',
      count: item.count,
    }))
  }, [facetsSummary])

  const kingdomKeys = useMemo(
    () =>
      facetsSummary?.kingdomKey
        ?.map((item) => Number(item.name))
        .filter((value) => Number.isFinite(value))
        .slice(0, 5) ?? [],
    [facetsSummary],
  )

  const classKeys = useMemo(
    () =>
      facetsSummary?.classKey
        ?.map((item) => Number(item.name))
        .filter((value) => Number.isFinite(value))
        .slice(0, 5) ?? [],
    [facetsSummary],
  )

  const taxonKeys = useMemo(() => {
    const merged = new Set<number>()
    kingdomKeys.forEach((key) => merged.add(key))
    classKeys.forEach((key) => merged.add(key))
    return Array.from(merged)
  }, [kingdomKeys, classKeys])

  const taxonLabelsQuery = useQuery({
    queryKey: ['taxonLabels', taxonKeys],
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(
        taxonKeys.map(async (key) => {
          const species = await fetchSpecies({ speciesKey: key, signal })
          return [
            key,
            species.canonicalName ?? species.scientificName ?? `Key ${key}`,
          ] as const
        }),
      )
      return Object.fromEntries(entries)
    },
    enabled: taxonKeys.length > 0,
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

  const classBreakdown = useMemo(() => {
    if (!facetsSummary?.classKey?.length) return fallbackClassBreakdown
    return facetsSummary.classKey
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
      .slice(0, 3)
      .map((item) => item.name)
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

  const datasetTitles =
    datasetQuery.data?.map((dataset) => dataset.title).filter(Boolean) ?? []

  const maxSeasonality = useMemo(
    () => Math.max(...seasonalityData, 1),
    [seasonalityData],
  )
  const maxTrend = useMemo(
    () => Math.max(...yearTrendData.map((item) => item.count), 1),
    [yearTrendData],
  )
  const maxKingdom = useMemo(
    () => Math.max(...kingdomBreakdown.map((item) => item.count), 1),
    [kingdomBreakdown],
  )
  const maxClass = useMemo(
    () => Math.max(...classBreakdown.map((item) => item.count), 1),
    [classBreakdown],
  )

  const totalRecords = facetsQuery.data?.count ?? 0
  const updatedAt = facetsQuery.dataUpdatedAt
    ? new Date(facetsQuery.dataUpdatedAt).toLocaleTimeString()
    : '—'

  return {
    seasonalityData,
    yearTrendData,
    topSpeciesData,
    iucnSummaryData,
    kingdomBreakdown,
    classBreakdown,
    datasetTitles,
    totalRecords,
    updatedAt,
    speciesKeys,
    maxSeasonality,
    maxTrend,
    maxKingdom,
    maxClass,
  }
}
