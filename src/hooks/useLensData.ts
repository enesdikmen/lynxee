import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchDatasetMetadata,
  fetchOccurrenceFacets,
  fetchSpecies,
  fetchSpeciesVernacularNames,
} from '../api/gbif'
import {
  resolveSpeciesImage,
  type ImageSource,
  ALL_IMAGE_SOURCES,
} from '../api/speciesImage'
import {
  IUCN_LABELS,
  fallbackConservationSnapshot,
  fallbackKingdomBreakdown,
  fallbackSeasonality,
  fallbackTopSpecies,
} from '../data/lensFallbacks'
import {
  BRAND_NEW_RULE,
  HERO_SLOT_RULES,
  IN_SEASON_RULE,
  NIGHT_CREATURES_RULE,
  SMALL_WONDERS_RULE,
  type HeroSlotRule,
} from '../data/lensSelection'
import type {
  BreakdownItem,
  ConservationSnapshot,
  DatasetSummary,
  Place,
  SpeciesCard,
  ThematicStripCard,
  ThreatenedSpecies,
} from '../types/lens'

/** Build the geo-filter portion of a GBIF facet request from a Place.
 *  Uses the Nominatim bbox when present, else falls back to lat/lon + radius. */
const placeGeoParams = (place: Place) => ({
  latitude: place.latitude,
  longitude: place.longitude,
  radiusKm: place.radiusKm,
  bbox: place.bbox,
})

const hashText = (value: string) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const mulberry32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Seeded selection keeps regenerate deterministic for a given place + seed,
// while still allowing diversity when rules use pickFromTop > 1.
const seededPick = <T,>(items: T[], seedKey: string): T => {
  if (items.length === 1) return items[0]
  const rnd = mulberry32(hashText(seedKey))
  return items[Math.floor(rnd() * items.length)]
}

const seededShuffle = <T,>(items: T[], seedKey: string): T[] => {
  const rnd = mulberry32(hashText(seedKey))
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export type RecordsBreakdownItem = {
  key: string
  label: string
  hint: string
  count: number
  share: number
}

export type LensData = {
  seasonalityData: number[]
  topSpeciesData: SpeciesCard[]
  inSeasonSpecies: SpeciesCard[]
  smallWondersSpecies: SpeciesCard[]
  brandNewSpecies: SpeciesCard[]
  nightCreaturesSpecies: SpeciesCard[]
  thematicStripCards: ThematicStripCard[]
  conservationSnapshot: ConservationSnapshot
  kingdomBreakdown: BreakdownItem[]
  datasetSummaries: DatasetSummary[]
  totalRecords: number
  maxSeasonality: number
  multilingualNames: { language: string; name: string }[]
  recordsBreakdown: RecordsBreakdownItem[]
}

export type UseLensDataOptions = {
  /** Active image sources, in fallback priority order. */
  imageSources?: ImageSource[]
  /** Seed used for deterministic content-level variation. */
  contentSeed?: number
}

type TopSpeciesPoolData = {
  slots: Array<{
    slot: HeroSlotRule
    candidates: SpeciesCard[]
  }>
  vernacularsBySpecies: Record<
    number,
    Awaited<ReturnType<typeof fetchSpeciesVernacularNames>>['results']
  >
}

export const useLensData = (
  selectedPlace?: Place,
  options: UseLensDataOptions = {},
): LensData => {
  const imageSources = options.imageSources ?? ALL_IMAGE_SOURCES
  const contentSeed = options.contentSeed ?? 1

  const facetsQuery = useQuery({
    queryKey: ['occurrenceFacets', selectedPlace?.id],
    queryFn: ({ signal }) =>
      fetchOccurrenceFacets({
        ...(selectedPlace
          ? placeGeoParams(selectedPlace)
          : { latitude: 0, longitude: 0, radiusKm: 0 }),
        facetFields: [
          'month',
          'datasetKey',
          'kingdomKey',
          'basisOfRecord',
        ],
        facetLimit: 60,
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

  // Gallery species selection is config-driven via HERO_SLOT_RULES.
  // We fetch candidate pools once per place and reuse them on regenerate.
  const topSpeciesPoolQuery = useQuery({
    queryKey: ['topSpeciesPool', selectedPlace?.id],
    queryFn: async ({ signal }): Promise<TopSpeciesPoolData> => {
      if (!selectedPlace) return { slots: [], vernacularsBySpecies: {} }

      const getPoolForSlot = async (
        slot: HeroSlotRule,
      ): Promise<{ slot: HeroSlotRule; pool: Array<{ speciesKey: number; count: number }> } | null> => {
        for (const filter of slot.filters) {
          const response = await fetchOccurrenceFacets({
            ...placeGeoParams(selectedPlace),
            facetFields: ['speciesKey'],
            facetLimit: Math.max(slot.pickFromTop, 1),
            signal,
            ...filter,
          })

          const pool = (response.facets?.[0]?.counts ?? [])
            .map((c) => ({ speciesKey: Number(c.name), count: c.count }))
            .filter((c) => Number.isFinite(c.speciesKey))
            .slice(0, Math.max(slot.pickFromTop, 1))

          if (pool.length > 0) return { slot, pool }
        }
        return null
      }

      const slotPools = (
        await Promise.all(HERO_SLOT_RULES.map(getPoolForSlot))
      ).filter(
        (
          item,
        ): item is { slot: HeroSlotRule; pool: Array<{ speciesKey: number; count: number }> } =>
          item !== null,
      )

      const uniqueSpeciesKeys = Array.from(
        new Set(slotPools.flatMap((item) => item.pool.map((p) => p.speciesKey))),
      )

      const speciesInfo = await Promise.all(
        uniqueSpeciesKeys.map(async (speciesKey) => {
          const [species, vernacularNames] = await Promise.all([
            fetchSpecies({ speciesKey, signal }),
            fetchSpeciesVernacularNames({ speciesKey, signal }),
          ])

          // Image resolution is decoupled and handled by `imageMapQuery`
          // below so that toggling/reordering image sources does not force
          // a refetch of GBIF species/facet data.
          return {
            speciesKey,
            cardBase: {
              id: String(speciesKey),
              commonName:
                species.vernacularName ??
                species.canonicalName ??
                species.scientificName,
              scientificName: species.scientificName,
              canonicalName: species.canonicalName ?? species.scientificName,
              imageUrl: '',
              taxonLine: [species.kingdom, species.phylum, species.class]
                .filter(Boolean)
                .join(' · '),
            },
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

      const slots: TopSpeciesPoolData['slots'] = slotPools.map(({ slot, pool }) => ({
        slot,
        candidates: pool
          .map((candidate) => {
            const base = speciesByKey.get(candidate.speciesKey)
            if (!base) return null
            return {
              ...base,
              highlight: slot.label,
              popularity: candidate.count,
            }
          })
          .filter((candidate): candidate is SpeciesCard => candidate !== null),
      }))

      return { slots, vernacularsBySpecies }
    },
    enabled: Boolean(selectedPlace),
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const topSpeciesData = useMemo(() => {
    const slots = topSpeciesPoolQuery.data?.slots ?? []
    if (!slots.length) return fallbackTopSpecies

    const seen = new Set<string>()
    const picks: SpeciesCard[] = []
    for (const { slot, candidates } of slots) {
      if (!candidates.length) continue
      const chosen = seededPick(
        candidates,
        `${selectedPlace?.id ?? 'none'}:${slot.id}:${contentSeed}`,
      )
      if (seen.has(chosen.id)) continue
      seen.add(chosen.id)
      picks.push(chosen)
    }

    return picks.length ? picks : fallbackTopSpecies
  }, [topSpeciesPoolQuery.data, selectedPlace?.id, contentSeed])

  // ── Thematic lens strips ─────────────────────────────────────────
  // Helper: given a list of speciesKey + count picks, resolve names into
  // SpeciesCard[]. Image URLs are filled in later by the overlay step;
  // this function only fetches taxonomic metadata.
  const resolveSpeciesCards = async (
    picks: { speciesKey: number; count: number; highlight: string }[],
    signal: AbortSignal | undefined,
  ): Promise<SpeciesCard[]> => {
    return Promise.all(
      picks.map(async (item) => {
        const species = await fetchSpecies({ speciesKey: item.speciesKey, signal })
        return {
          id: String(item.speciesKey),
          commonName:
            species.vernacularName ??
            species.canonicalName ??
            species.scientificName,
          scientificName: species.scientificName,
          canonicalName: species.canonicalName ?? species.scientificName,
          imageUrl: '',
          highlight: item.highlight,
          taxonLine: [species.kingdom, species.phylum, species.class]
            .filter(Boolean)
            .join(' · '),
          popularity: item.count,
        }
      }),
    )
  }

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

  // Lens 1 — "In season right now": top species recorded in the current month
  // (with photos) within the place. Uses month facet param.
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const inSeasonQuery = useQuery({
    queryKey: ['lensInSeason', selectedPlace?.id, currentMonth],
    queryFn: async ({ signal }): Promise<SpeciesCard[]> => {
      if (!selectedPlace) return []
      const response = await fetchOccurrenceFacets({
        ...placeGeoParams(selectedPlace),
        facetFields: ['speciesKey'],
        facetLimit: IN_SEASON_RULE.facetLimit,
        month: currentMonth,
        mediaType: IN_SEASON_RULE.mediaType,
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

  const inSeasonSpecies = inSeasonQuery.data ?? []

  // Lens 2 — "The small wonders": top species among insects (classKey=216)
  // and fungi (kingdomKey=5), merged by raw record count so a fungi-poor
  // city naturally shows more insects.
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

  const smallWondersSpecies = smallWondersQuery.data ?? []

  // Lens 3 — "Brand new here": species heavily observed in recent years,
  // then validated by each species' earliest local GBIF year.
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
      // Avoid large burst fan-out: validate only a bounded subset and stop once
      // we have enough picks for the strip.
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

  const brandNewSpecies = brandNewQuery.data ?? []

  // Lens 4 — "Night creatures": bats + owls + moth families mixed by count.
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

  const nightCreaturesSpecies = nightCreaturesQuery.data ?? []

  const thematicPool = useMemo<ThematicStripCard[]>(() => {
    const monthLabel = new Date(2000, currentMonth - 1, 1).toLocaleString('en', {
      month: 'long',
    })
    const fallbackStripSpecies = topSpeciesData.slice(0, 3)

    const cards: ThematicStripCard[] = [
      {
        id: 'inSeason',
        kicker: `🌸 In season · ${monthLabel}`,
        species: inSeasonSpecies.length > 0 ? inSeasonSpecies : fallbackStripSpecies,
      },
      {
        id: 'smallWonders',
        kicker: '🐛 Small wonders',
        species: smallWondersSpecies.length > 0 ? smallWondersSpecies : fallbackStripSpecies,
      },
      {
        id: 'brandNew',
        kicker: '📸 Brand new here',
        species: brandNewSpecies.length > 0 ? brandNewSpecies : fallbackStripSpecies,
      },
      {
        id: 'nightCreatures',
        kicker: '🌃 Night creatures',
        species: nightCreaturesSpecies.length > 0 ? nightCreaturesSpecies : fallbackStripSpecies,
      },
    ]

    return cards
  }, [
    currentMonth,
    topSpeciesData,
    inSeasonSpecies,
    smallWondersSpecies,
    brandNewSpecies,
    nightCreaturesSpecies,
  ])

  const thematicStripCards = useMemo(() => {
    if (thematicPool.length <= 2) return thematicPool
    return seededShuffle(
      thematicPool,
      `${selectedPlace?.id ?? 'none'}:thematic:${contentSeed}`,
    ).slice(0, 2)
  }, [thematicPool, selectedPlace?.id, contentSeed])

  // ── Conservation snapshot ──────────────────────────────────────────
  // Instead of raw IUCN record counts, we build a meaningful snapshot:
  //  • species counts per IUCN category (via speciesKey facet per category)
  //  • a headline "X threatened species" number
  //  • actual names/photos for the top threatened species

  const THREATENED_CATS = ['CR', 'EN', 'VU'] as const
  const ALL_CATS = ['LC', 'NT', 'VU', 'EN', 'CR', 'DD'] as const

  // For each IUCN category, get the number of distinct species (not records).
  const speciesCountsQuery = useQuery({
    queryKey: ['iucnSpeciesCounts', selectedPlace?.id],
    queryFn: async ({ signal }) => {
      if (!selectedPlace) return []
      const results = await Promise.all(
        ALL_CATS.map(async (cat) => {
          // Get species count per IUCN category by faceting on speciesKey.
          // A high facetLimit gives us the number of distinct species entries.
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

  // Top threatened species (CR/EN/VU) — names + photos for the at-risk card.
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
            mediaType: 'StillImage', // need a photo
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

  const conservationSnapshot = useMemo<ConservationSnapshot>(() => {
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

  // ── Hero species extras: multilingual common names from cached pools.
  const heroSpeciesKey = topSpeciesData[0]?.id
    ? Number(topSpeciesData[0].id)
    : undefined

  // Languages we want to feature on the multilingual strip, in display order.
  // Keep it visually diverse (Latin · Germanic · Romance · Slavic · Asian).
  const FEATURED_LANGS: { code: string; label: string }[] = [
    { code: 'eng', label: 'EN' },
    { code: 'deu', label: 'DE' },
    { code: 'fra', label: 'FR' },
    { code: 'spa', label: 'ES' },
    { code: 'ita', label: 'IT' },
    { code: 'pol', label: 'PL' },
    { code: 'rus', label: 'RU' },
    { code: 'jpn', label: 'JA' },
    { code: 'zho', label: 'ZH' },
    { code: 'nld', label: 'NL' },
    { code: 'por', label: 'PT' },
  ]

  const multilingualNames = useMemo(() => {
    const list =
      heroSpeciesKey && Number.isFinite(heroSpeciesKey)
        ? topSpeciesPoolQuery.data?.vernacularsBySpecies[heroSpeciesKey] ?? []
        : []
    if (!list.length) return []
    const byLang = new Map<string, string>()
    for (const item of list) {
      const lang = (item.language ?? '').toLowerCase()
      const name = item.vernacularName?.trim()
      if (!lang || !name) continue
      if (!byLang.has(lang)) byLang.set(lang, name)
    }
    const picked: { language: string; name: string }[] = []
    for (const { code, label } of FEATURED_LANGS) {
      const name = byLang.get(code)
      if (name) picked.push({ language: label, name })
      if (picked.length >= 5) break
    }
    return picked
  }, [heroSpeciesKey, topSpeciesPoolQuery.data])

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

  const totalRecords = facetsQuery.data?.count ?? 0

  // ── How we know this — basisOfRecord breakdown ──
  // Maps GBIF's enum into plain-language buckets so a viewer instantly grasps
  // who/what produced the records (citizen scientists vs museums vs sensors).
  const recordsBreakdown = useMemo<RecordsBreakdownItem[]>(() => {
    const counts = facetsSummary?.basisOfRecord ?? []
    if (!counts.length || totalRecords === 0) return []
    const META: Record<string, { label: string; hint: string }> = {
      HUMAN_OBSERVATION: {
        label: 'Citizen-science sightings',
        hint: 'people with cameras, notebooks & apps',
      },
      OBSERVATION: {
        label: 'Field observations',
        hint: 'surveys without a physical voucher',
      },
      MACHINE_OBSERVATION: {
        label: 'Cameras & sensors',
        hint: 'camera traps, acoustic & DNA detectors',
      },
      PRESERVED_SPECIMEN: {
        label: 'Museum & herbarium specimens',
        hint: 'physical samples in scientific collections',
      },
      MATERIAL_SAMPLE: {
        label: 'Field samples',
        hint: 'environmental DNA, traps, nets',
      },
      MATERIAL_CITATION: {
        label: 'Published research records',
        hint: 'occurrences cited in scientific literature',
      },
      LIVING_SPECIMEN: {
        label: 'Living collections',
        hint: 'zoos, botanical gardens, gene banks',
      },
      FOSSIL_SPECIMEN: {
        label: 'Fossils',
        hint: 'preserved remains from deep time',
      },
      OCCURRENCE: {
        label: 'Other records',
        hint: 'unspecified record type',
      },
    }
    return counts.map((c) => {
      const meta = META[c.name] ?? { label: c.name, hint: '' }
      return {
        key: c.name,
        label: meta.label,
        hint: meta.hint,
        count: c.count,
        share: c.count / totalRecords,
      }
    })
  }, [facetsSummary, totalRecords])

  // ── Image overlay layer ──────────────────────────────────────────
  // All species data above is image-free. We collect every speciesKey that
  // ends up rendered and resolve images in a single dedicated query keyed
  // by the active source list. This means toggling/reordering image
  // sources does NOT refetch GBIF facets/species; it only re-resolves
  // images, which hit the per-source in-memory cache when possible.

  const speciesForImaging = useMemo(() => {
    const map = new Map<number, { speciesKey: number; canonicalName?: string }>()
    const collect = (cards: SpeciesCard[] | undefined) => {
      cards?.forEach((c) => {
        const key = Number(c.id)
        if (!Number.isFinite(key) || map.has(key)) return
        // Skip fallback entries that already ship a baked image URL.
        if (c.imageUrl) return
        map.set(key, { speciesKey: key, canonicalName: c.canonicalName })
      })
    }
    collect(topSpeciesData)
    collect(inSeasonSpecies)
    collect(smallWondersSpecies)
    collect(brandNewSpecies)
    collect(nightCreaturesSpecies)
    collect(threatenedSpeciesQuery.data)
    return Array.from(map.values()).sort((a, b) => a.speciesKey - b.speciesKey)
  }, [
    topSpeciesData,
    inSeasonSpecies,
    smallWondersSpecies,
    brandNewSpecies,
    nightCreaturesSpecies,
    threatenedSpeciesQuery.data,
  ])

  const imageMapQuery = useQuery({
    queryKey: [
      'speciesImages',
      speciesForImaging.map((s) => s.speciesKey).join(','),
      imageSources.join(','),
    ],
    queryFn: async () => {
      const map = new Map<number, { url: string; squareUrl?: string }>()
      if (imageSources.length === 0) return map
      await Promise.all(
        speciesForImaging.map(async ({ speciesKey, canonicalName }) => {
          const img = await resolveSpeciesImage({
            speciesKey,
            scientificName: canonicalName,
            sources: imageSources,
          })
          // Only store real hits — null means "no active source had one".
          // The card renders empty src and CSS hides the broken-image glyph.
          if (img?.url) map.set(speciesKey, { url: img.url, squareUrl: img.squareUrl })
        }),
      )
      return map
    },
    enabled: speciesForImaging.length > 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
  })

  const imageMap = imageMapQuery.data

  const applyImage = useMemo(() => {
    return <T extends SpeciesCard>(card: T): T => {
      const img = imageMap?.get(Number(card.id))
      if (!img) return card
      return { ...card, imageUrl: img.url, squareImageUrl: img.squareUrl }
    }
  }, [imageMap])

  const imagedTopSpecies = useMemo(
    () => topSpeciesData.map(applyImage),
    [topSpeciesData, applyImage],
  )
  const imagedInSeason = useMemo(
    () => inSeasonSpecies.map(applyImage),
    [inSeasonSpecies, applyImage],
  )
  const imagedSmallWonders = useMemo(
    () => smallWondersSpecies.map(applyImage),
    [smallWondersSpecies, applyImage],
  )
  const imagedBrandNew = useMemo(
    () => brandNewSpecies.map(applyImage),
    [brandNewSpecies, applyImage],
  )
  const imagedNightCreatures = useMemo(
    () => nightCreaturesSpecies.map(applyImage),
    [nightCreaturesSpecies, applyImage],
  )
  const imagedThematicStripCards = useMemo(
    () =>
      thematicStripCards.map((c) => ({
        ...c,
        species: c.species.map(applyImage),
      })),
    [thematicStripCards, applyImage],
  )
  const imagedConservationSnapshot = useMemo(
    () => ({
      ...conservationSnapshot,
      threatenedSpecies: conservationSnapshot.threatenedSpecies.map(applyImage),
    }),
    [conservationSnapshot, applyImage],
  )

  return {
    seasonalityData,
    topSpeciesData: imagedTopSpecies,
    inSeasonSpecies: imagedInSeason,
    smallWondersSpecies: imagedSmallWonders,
    brandNewSpecies: imagedBrandNew,
    nightCreaturesSpecies: imagedNightCreatures,
    thematicStripCards: imagedThematicStripCards,
    conservationSnapshot: imagedConservationSnapshot,
    kingdomBreakdown,
    datasetSummaries,
    totalRecords,
    maxSeasonality,
    multilingualNames,
    recordsBreakdown,
  }
}
