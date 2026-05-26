import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOccurrenceFacets, fetchSpecies } from '../../api/gbif'
import {
  IUCN_LABELS,
  fallbackConservationSnapshot,
} from '../../data/lensFallbacks'
import type { ConservationSnapshot, Place, ThreatenedSpecies } from '../../types/lens'
import { placeGeoParams, seededPick } from './shared'
import { speciesCardBase } from './speciesCards'

type ConservationLensResult = {
  snapshot: ConservationSnapshot
  isReady: boolean
}

const THREATENED_CATS = ['CR', 'EN', 'VU'] as const
const ALL_CATS = ['LC', 'NT', 'VU', 'EN', 'CR', 'DD'] as const
const THREATENED_FACET_LIMIT = 5
const THREATENED_PICK_FROM_TOP_PER_GROUP = 3

type ThreatenedCandidate = {
  speciesKey: number
  count: number
  group: string
  species: Awaited<ReturnType<typeof fetchSpecies>>
  winningCat: (typeof THREATENED_CATS)[number]
}

export const useConservationSnapshot = (
  selectedPlace: Place | undefined,
  contentSeed: number,
): ConservationLensResult => {
  const speciesCountsQuery = useQuery({
    queryKey: ['iucnSpeciesCounts', selectedPlace?.id],
    queryFn: async ({ signal }) => {
      if (!selectedPlace) return []
      const results = await Promise.all(
        ALL_CATS.map(async (cat) => {
          const response = await fetchOccurrenceFacets({
            ...placeGeoParams(selectedPlace),
            facetFields: ['speciesKey'],
            facetLimit: 500,
            iucnRedListCategory: cat,
            signal,
          })
          const speciesCount = response.facets?.[0]?.counts?.length ?? 0
          return {
            status: cat,
            label: IUCN_LABELS[cat] ?? cat,
            speciesCount,
          }
        }),
      )
      return results
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 10,
  })

  const threatenedSpeciesQuery = useQuery({
    queryKey: ['threatenedSpecies', selectedPlace?.id],
    queryFn: async ({ signal }): Promise<ThreatenedCandidate[]> => {
      if (!selectedPlace) return []

      // Cascade: use the highest severity that has results.
      let raw: Array<{ speciesKey: number; count: number }> = []
      let winningCat: (typeof THREATENED_CATS)[number] = 'CR'
      for (const cat of THREATENED_CATS) {
        const response = await fetchOccurrenceFacets({
          ...placeGeoParams(selectedPlace),
          facetFields: ['speciesKey'],
          facetLimit: THREATENED_FACET_LIMIT,
          iucnRedListCategory: cat,
          signal,
        })
        raw = (response.facets?.[0]?.counts ?? [])
          .map((c) => ({ speciesKey: Number(c.name), count: c.count }))
          .filter((c) => Number.isFinite(c.speciesKey))
        if (raw.length > 0) {
          winningCat = cat
          break
        }
      }
      if (!raw.length) return []

      // Resolve species info so we can class-cap.
      const resolved = await Promise.all(
        raw.map(async (item) => {
          const species = await fetchSpecies({ speciesKey: item.speciesKey, signal })
          return { ...item, species }
        }),
      )

      // Group candidates for per-group seeded picks in useMemo.
      resolved.sort((a, b) => b.count - a.count)
      return resolved.map((item) => {
        const group =
          item.species.kingdom === 'Animalia'
            ? (item.species.class ?? 'unknown')
            : (item.species.kingdom ?? 'unknown')
        return {
          speciesKey: item.speciesKey,
          count: item.count,
          group,
          species: item.species,
          winningCat,
        }
      })
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 30,
  })

  const snapshot = useMemo<ConservationSnapshot>(() => {
    if (!speciesCountsQuery.data?.length) return fallbackConservationSnapshot

    const categoryBreakdown = speciesCountsQuery.data.map((c) => ({
      status: c.status,
      label: c.label,
      count: c.speciesCount,
    }))

    const totalAssessedSpecies = categoryBreakdown.reduce(
      (sum, c) => sum + c.count,
      0,
    )
    const threatenedCount = categoryBreakdown
      .filter((c) =>
        (THREATENED_CATS as readonly string[]).includes(c.status),
      )
      .reduce((sum, c) => sum + c.count, 0)
    const threatenedPercent =
      totalAssessedSpecies > 0
        ? Math.round((threatenedCount / totalAssessedSpecies) * 1000) / 10
        : 0

    const groupedThreatened = new Map<string, ThreatenedCandidate[]>()
    for (const candidate of threatenedSpeciesQuery.data ?? []) {
      const bucket = groupedThreatened.get(candidate.group)
      if (bucket) {
        bucket.push(candidate)
      } else {
        groupedThreatened.set(candidate.group, [candidate])
      }
    }

    const threatenedSpecies = Array.from(groupedThreatened.entries())
      .map(([group, bucket]) => {
        bucket.sort((a, b) => b.count - a.count)
        const top = bucket.slice(0, THREATENED_PICK_FROM_TOP_PER_GROUP)
        const picked = seededPick(
          top,
          `${selectedPlace?.id ?? 'none'}:threatened:${group}:${contentSeed}`,
        )
        return {
          ...speciesCardBase(picked.speciesKey, picked.species),
          highlight: IUCN_LABELS[picked.winningCat] ?? picked.winningCat,
          popularity: picked.count,
          iucnCategory: picked.winningCat,
          iucnLabel: IUCN_LABELS[picked.winningCat] ?? picked.winningCat,
        } as ThreatenedSpecies
      })
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))

    return {
      totalAssessedSpecies,
      threatenedCount,
      threatenedPercent,
      categoryBreakdown,
      threatenedSpecies,
    }
  }, [
    speciesCountsQuery.data,
    threatenedSpeciesQuery.data,
    selectedPlace?.id,
    contentSeed,
  ])

  const isReady =
    !selectedPlace ||
    [speciesCountsQuery, threatenedSpeciesQuery].every(
      (q) => q.isSuccess || q.isError,
    )

  return { snapshot, isReady }
}
