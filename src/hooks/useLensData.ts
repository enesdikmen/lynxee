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
  DatasetSummary,
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
  datasetSummaries: DatasetSummary[]
  totalRecords: number
  updatedAt: string
  maxSeasonality: number
  maxTrend: number
  maxKingdom: number
  maxClass: number
}

export type UseLensDataOptions = {
  onlyWithImages?: boolean
}

export const useLensData = (
  selectedPlace?: Place,
  options: UseLensDataOptions = {},
): LensData => {
  const onlyWithImages = options.onlyWithImages ?? false

  const facetsQuery = useQuery({
    queryKey: ['occurrenceFacets', selectedPlace?.id, onlyWithImages],
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
        // Higher facet limit when filtering to images so we still get enough species.
        facetLimit: onlyWithImages ? 120 : 60,
        mediaType: onlyWithImages ? 'StillImage' : undefined,
        signal,
      }),
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 10,
  })

  const facetsSummary = useMemo(() => {
    if (!facetsQuery.data) return null

    // Normalize GBIF facet field names (underscores vs camel) for safe lookups.
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
    const sorted = facetsSummary.year
      .map((item) => ({
        year: Number(item.name),
        count: item.count,
      }))
      .filter((item) => Number.isFinite(item.year))
      .sort((a, b) => a.year - b.year)
    // Keep the latest decade to keep the chart legible.
    return sorted.slice(-10)
  }, [facetsSummary])

  const classKeys = useMemo(
    () =>
      facetsSummary?.classKey
        ?.map((item) => Number(item.name))
        .filter((value) => Number.isFinite(value))
        // Limit per-class lookups to avoid excessive API calls.
        .slice(0, 8) ?? [],
    [facetsSummary],
  )

  const topSpeciesQuery = useQuery({
    queryKey: ['topSpecies', selectedPlace?.id, classKeys, onlyWithImages],
    queryFn: async ({ signal }) => {
      if (!selectedPlace || !facetsSummary?.speciesKey?.length) return []

      const topOverallFacet = facetsSummary.speciesKey[0]
      const topOverallKey = Number(topOverallFacet?.name)
      const topOverallCount = topOverallFacet?.count ?? 0

      // Pick one representative species per major class to diversify the strip.
      const classSpecies = await Promise.all(
        classKeys.map(async (classKey) => {
          const response = await fetchOccurrenceFacets({
            latitude: selectedPlace.latitude,
            longitude: selectedPlace.longitude,
            radiusKm: selectedPlace.radiusKm,
            facetFields: ['speciesKey'],
            facetLimit: 1,
            classKey,
            mediaType: onlyWithImages ? 'StillImage' : undefined,
            signal,
          })

          const topCount = response.facets?.[0]?.counts?.[0]
          const speciesKey = Number(topCount?.name)
          if (!Number.isFinite(speciesKey)) return null

          return {
            classKey,
            speciesKey,
            count: topCount?.count ?? 0,
          }
        }),
      )

      const uniqueSpecies = new Map<
        number,
        { speciesKey: number; count: number; classKey?: number; isOverall?: boolean }
      >()

      if (Number.isFinite(topOverallKey)) {
        uniqueSpecies.set(topOverallKey, {
          speciesKey: topOverallKey,
          count: topOverallCount,
          isOverall: true,
        })
      }

      classSpecies.filter(Boolean).forEach((item) => {
        if (!item) return
        if (uniqueSpecies.has(item.speciesKey)) return
        uniqueSpecies.set(item.speciesKey, item)
      })

      const results = await Promise.all(
        Array.from(uniqueSpecies.values()).map(async (item) => {
          const species = await fetchSpecies({
            speciesKey: item.speciesKey,
            signal,
          })
          const media = await fetchSpeciesMedia({
            speciesKey: item.speciesKey,
            limit: 1,
            signal,
          })
          const mediaItem = media.results.find(
            (entry) => entry.identifier || entry.references,
          )
          const mediaUrl = mediaItem?.identifier ?? mediaItem?.references
          const imageUrl =
            mediaUrl ??
            'https://placehold.co/320x220/f3f4f6/1f2937?text=No+image'

          return {
            id: String(item.speciesKey),
            commonName:
              species.vernacularName ??
              species.canonicalName ??
              species.scientificName,
            scientificName: species.scientificName,
            imageUrl,
            highlight: species.rank
              ? `${species.rank} · ${species.kingdom ?? 'GBIF'}`
              : 'GBIF species',
            taxonLine: [species.kingdom, species.phylum, species.class]
              .filter(Boolean)
              .join(' · '),
            classGroup: species.class ?? species.kingdom ?? 'GBIF',
            popularity: item.count,
            isOverallTop: item.isOverall ?? false,
            hasImage: Boolean(mediaUrl),
          }
        }),
      )

      return results
    },
    enabled: Boolean(selectedPlace && facetsSummary?.speciesKey?.length),
    staleTime: 1000 * 60 * 20,
  })

  const topSpeciesData = useMemo(() => {
    if (!topSpeciesQuery.data?.length) return fallbackTopSpecies

    const sorted = [...topSpeciesQuery.data].sort(
      (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
    )

  // Ensure we show variety (different classes) while still featuring the overall top pick.
  const selectTopSpecies = (candidates: SpeciesCard[]) => {
      const selected: SpeciesCard[] = []
      const usedGroups = new Set<string>()
      const usedIds = new Set<string>()

      const topPick =
        candidates.find((item) => item.isOverallTop) ?? candidates[0]
      if (topPick) {
        selected.push(topPick)
        usedIds.add(topPick.id)
        if (topPick.classGroup) usedGroups.add(topPick.classGroup)
      }

      for (const candidate of candidates.slice(1)) {
        const group = candidate.classGroup ?? 'GBIF'
        if (usedGroups.has(group)) continue
        selected.push(candidate)
        usedIds.add(candidate.id)
        usedGroups.add(group)
        if (selected.length === 6) break
      }

      if (selected.length < 6) {
        for (const candidate of candidates.slice(1)) {
          if (usedIds.has(candidate.id)) continue
          selected.push(candidate)
          usedIds.add(candidate.id)
          if (selected.length === 6) break
        }
      }

      return { selected, usedIds }
    }

    const primaryCandidates = onlyWithImages
      ? sorted.filter((item) => item.hasImage)
      : sorted
    const { selected, usedIds } = selectTopSpecies(primaryCandidates)

    if (onlyWithImages && selected.length < 6) {
      for (const candidate of sorted) {
        if (usedIds.has(candidate.id)) continue
        selected.push(candidate)
        usedIds.add(candidate.id)
        if (selected.length === 6) break
      }
    }

    return selected
  }, [topSpeciesQuery.data, onlyWithImages])

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

  const classKeyList = useMemo(
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
    classKeyList.forEach((key) => merged.add(key))
    return Array.from(merged)
  }, [kingdomKeys, classKeyList])

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
    // Keep attribution short while still crediting key sources.
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

  const datasetSummaries: DatasetSummary[] =
    datasetQuery.data
      ?.map((dataset) => ({
        key: dataset.key,
        title: dataset.title,
        doi: dataset.doi,
        publisher: dataset.publisher,
        license: dataset.license,
      }))
      .filter((dataset) => dataset.title) ?? []

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
    datasetSummaries,
    totalRecords,
    updatedAt,
    maxSeasonality,
    maxTrend,
    maxKingdom,
    maxClass,
  }
}
