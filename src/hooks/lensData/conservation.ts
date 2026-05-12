import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOccurrenceFacets } from '../../api/gbif'
import {
  IUCN_LABELS,
  fallbackConservationSnapshot,
} from '../../data/lensFallbacks'
import type { ConservationSnapshot, Place, ThreatenedSpecies } from '../../types/lens'
import { placeGeoParams } from './shared'
import { resolveSpeciesCards } from './speciesCards'

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
      const perCat = await Promise.all(
        THREATENED_CATS.map(async (cat) => {
          const response = await fetchOccurrenceFacets({
            ...placeGeoParams(selectedPlace),
            facetFields: ['speciesKey'],
            facetLimit: 3,
            iucnRedListCategory: cat,
            signal,
          })
          return (response.facets?.[0]?.counts ?? []).map((c) => ({
            speciesKey: Number(c.name),
            count: c.count,
            cat,
          }))
        }),
      )
      const severity: Record<string, number> = { CR: 0, EN: 1, VU: 2 }
      const all = perCat
        .flat()
        .filter((s) => Number.isFinite(s.speciesKey))
        .sort(
          (a, b) =>
            (severity[a.cat] ?? 9) - (severity[b.cat] ?? 9) ||
            b.count - a.count,
        )
      const seen = new Set<number>()
      const picks: typeof all = []
      for (const item of all) {
        if (seen.has(item.speciesKey)) continue
        seen.add(item.speciesKey)
        picks.push(item)
        if (picks.length >= 3) break
      }
      const cards = await resolveSpeciesCards(
        picks.map((p) => ({
          speciesKey: p.speciesKey,
          count: p.count,
          highlight: IUCN_LABELS[p.cat] ?? p.cat,
        })),
        signal,
      )
      return cards.map((card, i) => ({
        ...card,
        iucnCategory: picks[i].cat,
        iucnLabel: IUCN_LABELS[picks[i].cat] ?? picks[i].cat,
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
