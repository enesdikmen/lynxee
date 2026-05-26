import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOccurrenceFacets } from '../../api/gbif'
import {
  BRAND_NEW_RULE,
  IN_SEASON_RULE,
  NIGHT_CREATURES_RULE,
  SMALL_WONDERS_RULE,
} from '../../data/lensSelection'
import type { Place, SpeciesCard, ThematicStripCard } from '../../types/lens'
import { placeGeoParams, seededShuffle } from './shared'
import { resolveSpeciesCards } from './speciesCards'

/**
 * Each query fetches a small *candidate list* (not a single pick) so that
 * the cross-lens dedup pass in `dedupe.ts` can fall through to the next
 * candidate when [0] is already claimed by a higher-priority card. The
 * renderer (`bentoTiles.tsx`) only shows `species[0]`.
 *
 * We return all 4 themes in a deterministic shuffled order; dedup picks
 * the first 2 that still have surviving candidates after filtering.
 */
export type ThematicLensResult = {
  thematicStripCards: ThematicStripCard[]
  isReady: boolean
}

export const useThematicLensData = (
  selectedPlace: Place | undefined,
  contentSeed: number,
): ThematicLensResult => {
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const resolveMergedStrip = async (
    sources: { label: string; filter: Record<string, number | undefined> }[],
    facetLimit: number,
    stripSize: number,
    signal: AbortSignal | undefined,
  ): Promise<SpeciesCard[]> => {
    if (!selectedPlace) return []

    const baseReq = {
      ...placeGeoParams(selectedPlace),
      facetFields: ['speciesKey'] as Array<'speciesKey'>,
      facetLimit,
      signal,
    }

    const responses = await Promise.all(
      sources.map(async (source) => ({
        label: source.label,
        response: await fetchOccurrenceFacets({
          ...baseReq,
          ...source.filter,
        }),
      })),
    )

    const all = responses
      .flatMap(({ label, response }) =>
        (response.facets?.[0]?.counts ?? []).map((c) => ({
          speciesKey: Number(c.name),
          count: c.count,
          highlight: label,
        })),
      )
      .filter((c) => Number.isFinite(c.speciesKey))
      .sort((a, b) => b.count - a.count)

    const seen = new Set<number>()
    const picks: typeof all = []
    for (const item of all) {
      if (seen.has(item.speciesKey)) continue
      seen.add(item.speciesKey)
      picks.push(item)
      if (picks.length >= stripSize) break
    }

    return resolveSpeciesCards(picks, signal)
  }

  const inSeasonQuery = useQuery({
    queryKey: ['lensInSeason', selectedPlace?.id, currentMonth],
    queryFn: async ({ signal }): Promise<SpeciesCard[]> => {
      if (!selectedPlace) return []
      const response = await fetchOccurrenceFacets({
        ...placeGeoParams(selectedPlace),
        facetFields: ['speciesKey'],
        facetLimit: IN_SEASON_RULE.facetLimit,
        month: currentMonth,
        signal,
      })
      const counts = response.facets?.[0]?.counts ?? []
      const picks = counts
        .map((c) => ({ speciesKey: Number(c.name), count: c.count }))
        .filter((c) => Number.isFinite(c.speciesKey))
        .slice(0, IN_SEASON_RULE.stripSize)
        .map((c) => ({ ...c, highlight: IN_SEASON_RULE.highlight }))
      return resolveSpeciesCards(picks, signal)
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 30,
  })

  const smallWondersQuery = useQuery({
    queryKey: ['lensSmallWonders', selectedPlace?.id],
    queryFn: async ({ signal }): Promise<SpeciesCard[]> => {
      return resolveMergedStrip(
        SMALL_WONDERS_RULE.sources,
        SMALL_WONDERS_RULE.facetLimit,
        SMALL_WONDERS_RULE.stripSize,
        signal,
      )
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 30,
  })

  const recentStartYear = currentYear - BRAND_NEW_RULE.recentYearsWindow + 1
  const brandNewQuery = useQuery({
    queryKey: [
      'lensBrandNew',
      selectedPlace?.id,
      recentStartYear,
      currentYear,
    ],
    queryFn: async ({ signal }): Promise<SpeciesCard[]> => {
      if (!selectedPlace) return []

      const response = await fetchOccurrenceFacets({
        ...placeGeoParams(selectedPlace),
        facetFields: ['speciesKey'],
        facetLimit: BRAND_NEW_RULE.candidateLimit,
        year: `${recentStartYear},${currentYear}`,
        signal,
      })

      const candidates = (response.facets?.[0]?.counts ?? [])
        .map((c) => ({ speciesKey: Number(c.name), count: c.count }))
        .filter((c) => Number.isFinite(c.speciesKey))

      const checkedCandidates = candidates.slice(0, BRAND_NEW_RULE.maxYearChecks)
      const validated: Array<{ speciesKey: number; count: number; earliestYear: number }> = []

      for (const candidate of checkedCandidates) {
        const yearsResponse = await fetchOccurrenceFacets({
          ...placeGeoParams(selectedPlace),
          speciesKey: candidate.speciesKey,
          facetFields: ['year'],
          facetLimit: BRAND_NEW_RULE.yearFacetLimit,
          signal,
        })

        const years = (yearsResponse.facets?.[0]?.counts ?? [])
          .map((c) => Number(c.name))
          .filter((year) => Number.isFinite(year))
          .sort((a, b) => a - b)

        const earliestYear = years[0]
        if (!earliestYear || earliestYear < recentStartYear) continue

        validated.push({
          speciesKey: candidate.speciesKey,
          count: candidate.count,
          earliestYear,
        })

        if (validated.length >= BRAND_NEW_RULE.stripSize) break
      }

      const picks = validated
        .sort((a, b) => b.earliestYear - a.earliestYear || b.count - a.count)
        .slice(0, BRAND_NEW_RULE.stripSize)
        .map((item) => ({
          speciesKey: item.speciesKey,
          count: item.count,
          highlight: `First local GBIF year ${item.earliestYear}`,
        }))

      return resolveSpeciesCards(picks, signal)
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 30,
  })

  const nightCreaturesQuery = useQuery({
    queryKey: ['lensNightCreatures', selectedPlace?.id],
    queryFn: async ({ signal }): Promise<SpeciesCard[]> => {
      return resolveMergedStrip(
        NIGHT_CREATURES_RULE.sources,
        NIGHT_CREATURES_RULE.facetLimit,
        NIGHT_CREATURES_RULE.stripSize,
        signal,
      )
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 30,
  })

  const thematicStripCards = useMemo<ThematicStripCard[]>(() => {
    const monthLabel = new Date(2000, currentMonth - 1, 1).toLocaleString('en', {
      month: 'long',
    })
    const all: ThematicStripCard[] = [
      {
        id: 'inSeason',
        kicker: `🌸 In season · ${monthLabel}`,
        species: inSeasonQuery.data ?? [],
      },
      {
        id: 'smallWonders',
        kicker: '🐛 Small wonders',
        species: smallWondersQuery.data ?? [],
      },
      {
        id: 'brandNew',
        kicker: '📸 Brand new here',
        species: brandNewQuery.data ?? [],
      },
      {
        id: 'nightCreatures',
        kicker: '🌃 Night creatures',
        species: nightCreaturesQuery.data ?? [],
      },
    ]
    // Deterministic shuffle per place + seed; dedup picks the first two
    // surviving themes downstream.
    return seededShuffle(
      all,
      `${selectedPlace?.id ?? 'none'}:thematic:${contentSeed}`,
    )
  }, [
    currentMonth,
    inSeasonQuery.data,
    smallWondersQuery.data,
    brandNewQuery.data,
    nightCreaturesQuery.data,
    selectedPlace?.id,
    contentSeed,
  ])

  const isReady =
    !selectedPlace ||
    [inSeasonQuery, smallWondersQuery, brandNewQuery, nightCreaturesQuery].every(
      (q) => q.isSuccess || q.isError,
    )

  return { thematicStripCards, isReady }
}
