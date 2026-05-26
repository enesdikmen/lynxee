import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchOccurrenceFacets,
  fetchSpecies,
  fetchSpeciesVernacularNames,
} from '../../api/gbif'
import { fallbackTopSpecies } from '../../data/lensFallbacks'
import {
  DEFAULT_PICK_FROM_TOP,
  EXTRA_MINI_SLOT_COUNT,
  EXTRA_MINI_SLOT_RULES,
  HERO_SLOT_RULES,
  MAX_SPECIES_MINI_COUNT,
  MIN_COUNT_RATIO,
  type HeroSlotRule,
} from '../../data/lensSelection'
import type { Place, SpeciesCard } from '../../types/lens'
import { placeGeoParams, seededShuffle } from './shared'
import { speciesCardBase } from './speciesCards'

type TopSpeciesPoolData = {
  slots: Array<{
    slot: HeroSlotRule
    candidates: SpeciesCard[]
  }>
  extraMiniSlots: Array<{
    slot: HeroSlotRule
    candidates: SpeciesCard[]
  }>
  vernacularsBySpecies: Record<
    number,
    Awaited<ReturnType<typeof fetchSpeciesVernacularNames>>['results']
  >
}

export type TopSpeciesResult = {
  topSpeciesData: SpeciesCard[]
  vernacularsBySpecies: TopSpeciesPoolData['vernacularsBySpecies']
  isReady: boolean
}

export const useTopSpeciesData = (
  selectedPlace: Place | undefined,
  contentSeed: number,
): TopSpeciesResult => {
  const topSpeciesPoolQuery = useQuery({
    queryKey: ['topSpeciesPool', selectedPlace?.id],
    queryFn: async ({ signal }): Promise<TopSpeciesPoolData> => {
      if (!selectedPlace) return { slots: [], extraMiniSlots: [], vernacularsBySpecies: {} }

      const getPoolForSlot = async (
        slot: HeroSlotRule,
      ): Promise<
        | {
            slot: HeroSlotRule
            pool: Array<{ speciesKey: number; count: number }>
          }
        | null
      > => {
        for (const filter of slot.filters) {
          const pick = slot.pickFromTop ?? DEFAULT_PICK_FROM_TOP
          const response = await fetchOccurrenceFacets({
            ...placeGeoParams(selectedPlace),
            facetFields: ['speciesKey'],
            facetLimit: pick,
            signal,
            ...filter,
          })

          const pool = (response.facets?.[0]?.counts ?? [])
            .map((c) => ({ speciesKey: Number(c.name), count: c.count }))
            .filter((c) => Number.isFinite(c.speciesKey))
            .slice(0, pick)

          if (pool.length > 0) return { slot, pool }
        }
        return null
      }

      const buildSlotPools = async (rules: HeroSlotRule[]) =>
        (
          await Promise.all(rules.map(getPoolForSlot))
        ).filter(
          (
            item,
          ): item is {
            slot: HeroSlotRule
            pool: Array<{ speciesKey: number; count: number }>
          } => item !== null,
        )

      const slotPools = await buildSlotPools(HERO_SLOT_RULES)
      const extraMiniSlotPools = await buildSlotPools(EXTRA_MINI_SLOT_RULES)

      const uniqueSpeciesKeys = Array.from(
        new Set(
          [...slotPools, ...extraMiniSlotPools].flatMap((item) =>
            item.pool.map((p) => p.speciesKey),
          ),
        ),
      )

      const speciesInfo = await Promise.all(
        uniqueSpeciesKeys.map(async (speciesKey) => {
          const [species, vernacularNames] = await Promise.all([
            fetchSpecies({ speciesKey, signal }),
            fetchSpeciesVernacularNames({ speciesKey, signal }),
          ])

          return {
            speciesKey,
            cardBase: speciesCardBase(speciesKey, species),
            vernaculars: vernacularNames.results,
          }
        }),
      )

      const speciesByKey = new Map<number, (typeof speciesInfo)[number]['cardBase']>()
      const vernacularsBySpecies: TopSpeciesPoolData['vernacularsBySpecies'] = {}

      for (const info of speciesInfo) {
        speciesByKey.set(info.speciesKey, info.cardBase)
        vernacularsBySpecies[info.speciesKey] = info.vernaculars
      }

      const buildCandidates = (
        pools: Array<{
          slot: HeroSlotRule
          pool: Array<{ speciesKey: number; count: number }>
        }>,
      ): Array<{
        slot: HeroSlotRule
        candidates: SpeciesCard[]
      }> =>
        pools.map(({ slot, pool }) => {
          const candidates: SpeciesCard[] = []
          for (const candidate of pool) {
            const base = speciesByKey.get(candidate.speciesKey)
            if (!base) continue
            candidates.push({
              ...base,
              highlight: slot.label,
              popularity: candidate.count,
            })
          }
          // Keep only candidates with enough observations relative to the
          // slot's top hit so sparse places don't surface irrelevant species.
          const topCount = candidates[0]?.popularity ?? 0
          const viable =
            topCount > 0
              ? candidates.filter(
                  (c) => (c.popularity ?? 0) >= topCount * MIN_COUNT_RATIO,
                )
              : candidates
          return { slot, candidates: viable }
        })

      const slots = buildCandidates(slotPools)
      const extraMiniSlots = buildCandidates(extraMiniSlotPools)

      return { slots, extraMiniSlots, vernacularsBySpecies }
    },
    enabled: Boolean(selectedPlace),
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const topSpeciesData = useMemo(() => {
    const slots = topSpeciesPoolQuery.data?.slots ?? []
    if (!slots.length) return fallbackTopSpecies

    const pickUnseenForSlot = (
      candidates: SpeciesCard[],
      seedKey: string,
      seen: Set<string>,
    ) => {
      const ordered = seededShuffle(candidates, `${seedKey}:order`)
      return ordered.find((candidate) => !seen.has(candidate.id))
    }

    const seen = new Set<string>()
    const picks: SpeciesCard[] = []
    for (const { slot, candidates } of slots) {
      if (!candidates.length) continue
      const chosen = pickUnseenForSlot(
        candidates,
        `${selectedPlace?.id ?? 'none'}:${slot.id}:${contentSeed}`,
        seen,
      )
      if (!chosen) continue
      seen.add(chosen.id)
      picks.push(chosen)
    }

    const extraMiniSlots = seededShuffle(
      topSpeciesPoolQuery.data?.extraMiniSlots ?? [],
      `${selectedPlace?.id ?? 'none'}:extra-mini-slots:${contentSeed}`,
    )
    for (const { slot, candidates } of extraMiniSlots) {
      if (picks.length >= slots.length + EXTRA_MINI_SLOT_COUNT) break
      if (!candidates.length) continue
      const chosen = pickUnseenForSlot(
        candidates,
        `${selectedPlace?.id ?? 'none'}:${slot.id}:${contentSeed}`,
        seen,
      )
      if (!chosen) continue
      seen.add(chosen.id)
      picks.push(chosen)
    }

    // Backfill from fallback cards so mini slots can still render when local
    // category data is sparse.
    const minimumCount = 1 + MAX_SPECIES_MINI_COUNT
    if (picks.length < minimumCount) {
      for (const fallback of seededShuffle(
        fallbackTopSpecies,
        `${selectedPlace?.id ?? 'none'}:fallback-top-species:${contentSeed}`,
      )) {
        if (seen.has(fallback.id)) continue
        seen.add(fallback.id)
        picks.push(fallback)
        if (picks.length >= minimumCount) break
      }
    }

    return picks.length ? picks : fallbackTopSpecies
  }, [topSpeciesPoolQuery.data, selectedPlace?.id, contentSeed])

  return {
    topSpeciesData,
    vernacularsBySpecies: topSpeciesPoolQuery.data?.vernacularsBySpecies ?? {},
    isReady:
      !selectedPlace ||
      topSpeciesPoolQuery.isSuccess ||
      topSpeciesPoolQuery.isError,
  }
}
