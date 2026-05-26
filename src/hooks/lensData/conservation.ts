import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOccurrenceFacets, fetchSpecies } from '../../api/gbif'
import {
  IUCN_LABELS,
  fallbackConservationSnapshot,
} from '../../data/lensFallbacks'
import type { ConservationSnapshot, Place, ThreatenedSpecies } from '../../types/lens'
import { placeGeoParams } from './shared'
import { speciesCardBase } from './speciesCards'

const THREATENED_CATS = ['CR', 'EN', 'VU'] as const
const ALL_CATS = ['LC', 'NT', 'VU', 'EN', 'CR', 'DD'] as const

export const useConservationSnapshot = (
  selectedPlace: Place | undefined,
): ConservationSnapshot => {
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
    queryFn: async ({ signal }): Promise<ThreatenedSpecies[]> => {
      if (!selectedPlace) return []

      // Cascade: use the highest severity that has results.
      let raw: Array<{ speciesKey: number; count: number }> = []
      let winningCat: (typeof THREATENED_CATS)[number] = 'CR'
      for (const cat of THREATENED_CATS) {
        const response = await fetchOccurrenceFacets({
          ...placeGeoParams(selectedPlace),
          facetFields: ['speciesKey'],
          facetLimit: 5,
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

      // Diversity cap: max 1 species per group. For animals we cap by
      // class (mammal ≠ bird ≠ reptile), for everything else by kingdom
      // (all plants = 1 slot, all fungi = 1 slot) because plant classes
      // (Magnoliopsida, Liliopsida …) all look the same on a poster.
      resolved.sort((a, b) => b.count - a.count)
      const seenGroups = new Set<string>()
      const pool = resolved.filter((item) => {
        const group =
          item.species.kingdom === 'Animalia'
            ? (item.species.class ?? 'unknown')
            : (item.species.kingdom ?? 'unknown')
        if (seenGroups.has(group)) return false
        seenGroups.add(group)
        return true
      })

      return pool.map((item) => ({
        ...speciesCardBase(item.speciesKey, item.species),
        highlight: IUCN_LABELS[winningCat] ?? winningCat,
        popularity: item.count,
        iucnCategory: winningCat,
        iucnLabel: IUCN_LABELS[winningCat] ?? winningCat,
      }))
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 30,
  })

  return useMemo<ConservationSnapshot>(() => {
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

    return {
      totalAssessedSpecies,
      threatenedCount,
      threatenedPercent,
      categoryBreakdown,
      threatenedSpecies: threatenedSpeciesQuery.data ?? [],
    }
  }, [speciesCountsQuery.data, threatenedSpeciesQuery.data])
}
