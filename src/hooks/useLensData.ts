import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchDatasetMetadata,
  fetchOccurrenceFacets,
  fetchSpecies,
  fetchSpeciesMedia,
  fetchSpeciesVernacularNames,
} from '../api/gbif'
import {
  IUCN_LABELS,
  fallbackClassBreakdown,
  fallbackConservationSnapshot,
  fallbackKingdomBreakdown,
  fallbackSeasonality,
  fallbackTopSpecies,
  fallbackYearTrend,
} from '../data/lensFallbacks'
import type {
  BreakdownItem,
  ConservationSnapshot,
  DatasetSummary,
  Place,
  SpeciesCard,
  ThreatenedSpecies,
  YearTrendPoint,
} from '../types/lens'

export type RecordsBreakdownItem = {
  key: string
  label: string
  hint: string
  count: number
  share: number
}

export type LensData = {
  seasonalityData: number[]
  yearTrendData: YearTrendPoint[]
  topSpeciesData: SpeciesCard[]
  inSeasonSpecies: SpeciesCard[]
  smallWondersSpecies: SpeciesCard[]
  conservationSnapshot: ConservationSnapshot
  kingdomBreakdown: BreakdownItem[]
  classBreakdown: BreakdownItem[]
  datasetSummaries: DatasetSummary[]
  totalRecords: number
  updatedAt: string
  maxSeasonality: number
  maxTrend: number
  multilingualNames: { language: string; name: string }[]
  recordsBreakdown: RecordsBreakdownItem[]
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
          'datasetKey',
          'kingdomKey',
          'classKey',
          'basisOfRecord',
        ],
        facetLimit: 60,
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
      datasetKey: getCounts('datasetKey'),
      kingdomKey: getCounts('kingdomKey'),
      classKey: getCounts('classKey'),
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

  // The gallery has 6 fixed slots so an average viewer immediately sees a
  // balanced cross-section of life (mammal · bird · insect · flower · tree/fern
  // · fungus). For each slot we ask GBIF for the most-recorded species in that
  // taxonomic group for the place. If a slot has no data we walk down the
  // fallback list until something hits.
  type SpeciesSlot = {
    id: string
    label: string
    classKey?: number[] // tried in order
    kingdomKey?: number // used when the slot spans many classes (e.g. Fungi)
  }

  const SPECIES_SLOTS: SpeciesSlot[] = [
    { id: 'mammal', label: 'Mammal', classKey: [359, 358, 131] }, // Mammalia → Reptilia → Amphibia
    { id: 'bird', label: 'Bird', classKey: [212] }, // Aves
    { id: 'insect', label: 'Insect', classKey: [216] }, // Insecta
    { id: 'flower', label: 'Flowering plant', classKey: [220] }, // Magnoliopsida
    { id: 'tree-fern', label: 'Tree or fern', classKey: [194, 7228684, 196] }, // Pinopsida → Polypodiopsida → Liliopsida
    { id: 'fungus', label: 'Fungus', kingdomKey: 5 }, // Kingdom Fungi (any class)
  ]

  const topSpeciesQuery = useQuery({
    queryKey: ['topSpecies', selectedPlace?.id, onlyWithImages],
    queryFn: async ({ signal }): Promise<SpeciesCard[]> => {
      if (!selectedPlace) return []

      const pickTopSpeciesForSlot = async (
        slot: SpeciesSlot,
      ): Promise<{ slot: SpeciesSlot; speciesKey: number; count: number } | null> => {
        const candidates = slot.kingdomKey
          ? [{ kingdomKey: slot.kingdomKey }]
          : (slot.classKey ?? []).map((classKey) => ({ classKey }))

        for (const filter of candidates) {
          const response = await fetchOccurrenceFacets({
            latitude: selectedPlace.latitude,
            longitude: selectedPlace.longitude,
            radiusKm: selectedPlace.radiusKm,
            facetFields: ['speciesKey'],
            facetLimit: 1,
            mediaType: onlyWithImages ? 'StillImage' : undefined,
            signal,
            ...filter,
          })
          const top = response.facets?.[0]?.counts?.[0]
          const speciesKey = Number(top?.name)
          if (Number.isFinite(speciesKey)) {
            return { slot, speciesKey, count: top?.count ?? 0 }
          }
        }
        return null
      }

      const slotPicks = await Promise.all(SPECIES_SLOTS.map(pickTopSpeciesForSlot))

      // Dedupe in case two slots resolved to the same species (rare, but possible).
      const seen = new Set<number>()
      const picks = slotPicks.filter(
        (item): item is { slot: SpeciesSlot; speciesKey: number; count: number } => {
          if (!item || seen.has(item.speciesKey)) return false
          seen.add(item.speciesKey)
          return true
        },
      )

      return Promise.all(
        picks.map(async (item) => {
          const [species, media] = await Promise.all([
            fetchSpecies({ speciesKey: item.speciesKey, signal }),
            fetchSpeciesMedia({ speciesKey: item.speciesKey, limit: 1, signal }),
          ])
          const mediaItem = media.results.find(
            (entry) => entry.identifier || entry.references,
          )
          const imageUrl =
            mediaItem?.identifier ??
            mediaItem?.references ??
            'https://placehold.co/320x220/f3f4f6/1f2937?text=No+image'

          return {
            id: String(item.speciesKey),
            commonName:
              species.vernacularName ??
              species.canonicalName ??
              species.scientificName,
            scientificName: species.scientificName,
            imageUrl,
            highlight: item.slot.label,
            taxonLine: [species.kingdom, species.phylum, species.class]
              .filter(Boolean)
              .join(' · '),
            popularity: item.count,
          }
        }),
      )
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 20,
  })

  const topSpeciesData = topSpeciesQuery.data?.length
    ? topSpeciesQuery.data
    : fallbackTopSpecies

  // ── Thematic lens strips ─────────────────────────────────────────
  // Helper: given a list of speciesKey + count picks, resolve names + media
  // into SpeciesCard[]. Mirrors the gallery resolver above.
  const resolveSpeciesCards = async (
    picks: { speciesKey: number; count: number; highlight: string }[],
    signal: AbortSignal | undefined,
  ): Promise<SpeciesCard[]> => {
    return Promise.all(
      picks.map(async (item) => {
        const [species, media] = await Promise.all([
          fetchSpecies({ speciesKey: item.speciesKey, signal }),
          fetchSpeciesMedia({ speciesKey: item.speciesKey, limit: 1, signal }),
        ])
        const mediaItem = media.results.find(
          (entry) => entry.identifier || entry.references,
        )
        const imageUrl =
          mediaItem?.identifier ??
          mediaItem?.references ??
          'https://placehold.co/320x220/f3f4f6/1f2937?text=No+image'
        return {
          id: String(item.speciesKey),
          commonName:
            species.vernacularName ??
            species.canonicalName ??
            species.scientificName,
          scientificName: species.scientificName,
          imageUrl,
          highlight: item.highlight,
          taxonLine: [species.kingdom, species.phylum, species.class]
            .filter(Boolean)
            .join(' · '),
          popularity: item.count,
        }
      }),
    )
  }

  // Lens 1 — "In season right now": top species recorded in the current month
  // (with photos) within the place. Uses month facet param.
  const currentMonth = new Date().getMonth() + 1

  const inSeasonQuery = useQuery({
    queryKey: ['lensInSeason', selectedPlace?.id, currentMonth],
    queryFn: async ({ signal }): Promise<SpeciesCard[]> => {
      if (!selectedPlace) return []
      const response = await fetchOccurrenceFacets({
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        radiusKm: selectedPlace.radiusKm,
        facetFields: ['speciesKey'],
        facetLimit: 5,
        month: currentMonth,
        mediaType: 'StillImage',
        signal,
      })
      const counts = response.facets?.[0]?.counts ?? []
      const picks = counts
        .map((c) => ({ speciesKey: Number(c.name), count: c.count }))
        .filter((c) => Number.isFinite(c.speciesKey))
        .slice(0, 3)
        .map((c) => ({ ...c, highlight: 'Recorded this month' }))
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
    queryKey: ['lensSmallWonders', selectedPlace?.id, onlyWithImages],
    queryFn: async ({ signal }): Promise<SpeciesCard[]> => {
      if (!selectedPlace) return []
      const baseReq = {
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        radiusKm: selectedPlace.radiusKm,
        facetFields: ['speciesKey'] as const,
        facetLimit: 5,
        mediaType: onlyWithImages ? 'StillImage' : undefined,
        signal,
      }
      const [insects, fungi] = await Promise.all([
        fetchOccurrenceFacets({ ...baseReq, classKey: 216, facetFields: ['speciesKey'] }),
        fetchOccurrenceFacets({ ...baseReq, kingdomKey: 5, facetFields: ['speciesKey'] }),
      ])
      const all = [
        ...(insects.facets?.[0]?.counts ?? []).map((c) => ({
          speciesKey: Number(c.name),
          count: c.count,
          highlight: 'Insect',
        })),
        ...(fungi.facets?.[0]?.counts ?? []).map((c) => ({
          speciesKey: Number(c.name),
          count: c.count,
          highlight: 'Fungus',
        })),
      ]
        .filter((c) => Number.isFinite(c.speciesKey))
        .sort((a, b) => b.count - a.count)

      const seen = new Set<number>()
      const picks: typeof all = []
      for (const item of all) {
        if (seen.has(item.speciesKey)) continue
        seen.add(item.speciesKey)
        picks.push(item)
        if (picks.length >= 3) break
      }
      return resolveSpeciesCards(picks, signal)
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 30,
  })

  const smallWondersSpecies = smallWondersQuery.data ?? []

  // ── Conservation snapshot ──────────────────────────────────────────
  // Instead of raw IUCN record counts, we build a meaningful snapshot:
  //  • species counts per IUCN category (via speciesKey facet per category)
  //  • a headline "X threatened species" number
  //  • actual names/photos for the top threatened species

  const THREATENED_CATS = ['CR', 'EN', 'VU'] as const
  const ALL_CATS = ['LC', 'NT', 'VU', 'EN', 'CR', 'DD'] as const

  // For each IUCN category, get the number of distinct species (not records).
  const speciesCountsQuery = useQuery({
    queryKey: ['iucnSpeciesCounts', selectedPlace?.id, onlyWithImages],
    queryFn: async ({ signal }) => {
      if (!selectedPlace) return []
      const results = await Promise.all(
        ALL_CATS.map(async (cat) => {
          // Get species count per IUCN category by faceting on speciesKey.
          // A high facetLimit gives us the number of distinct species entries.
          const response = await fetchOccurrenceFacets({
            latitude: selectedPlace.latitude,
            longitude: selectedPlace.longitude,
            radiusKm: selectedPlace.radiusKm,
            facetFields: ['speciesKey'],
            facetLimit: 500,
            iucnRedListCategory: cat,
            mediaType: onlyWithImages ? 'StillImage' : undefined,
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

  // Get top threatened species (names + photos) — up to 5 across CR/EN/VU.
  const threatenedSpeciesQuery = useQuery({
    queryKey: ['threatenedSpecies', selectedPlace?.id, onlyWithImages],
    queryFn: async ({ signal }) => {
      if (!selectedPlace) return []

      // Gather top speciesKeys per threatened category.
      const perCat = await Promise.all(
        THREATENED_CATS.map(async (cat) => {
          const response = await fetchOccurrenceFacets({
            latitude: selectedPlace.latitude,
            longitude: selectedPlace.longitude,
            radiusKm: selectedPlace.radiusKm,
            facetFields: ['speciesKey'],
            facetLimit: 3,
            iucnRedListCategory: cat,
            mediaType: onlyWithImages ? 'StillImage' : undefined,
            signal,
          })
          return (response.facets?.[0]?.counts ?? []).map((c) => ({
            speciesKey: Number(c.name),
            recordCount: c.count,
            shortCategory: cat,
          }))
        }),
      )

      const all = perCat.flat().filter((s) => Number.isFinite(s.speciesKey))

      // Dedupe & keep top 5 by severity (CR first) then record count.
      const severityOrder: Record<string, number> = { CR: 0, EN: 1, VU: 2 }
      all.sort(
        (a, b) =>
          (severityOrder[a.shortCategory] ?? 9) -
            (severityOrder[b.shortCategory] ?? 9) ||
          b.recordCount - a.recordCount,
      )
      const unique = new Map<number, (typeof all)[0]>()
      for (const item of all) {
        if (!unique.has(item.speciesKey)) unique.set(item.speciesKey, item)
        if (unique.size >= 5) break
      }

      // Resolve names + photos.
      const resolved: ThreatenedSpecies[] = await Promise.all(
        Array.from(unique.values()).map(async (item) => {
          const species = await fetchSpecies({
            speciesKey: item.speciesKey,
            signal,
          })
          const media = await fetchSpeciesMedia({
            speciesKey: item.speciesKey,
            limit: 1,
            signal,
          })
          const mediaUrl =
            media.results.find((m) => m.identifier)?.identifier ?? undefined
          return {
            speciesKey: item.speciesKey,
            commonName:
              species.vernacularName ??
              species.canonicalName ??
              species.scientificName,
            scientificName: species.scientificName,
            imageUrl: mediaUrl,
            iucnCategory: item.shortCategory,
            iucnLabel: IUCN_LABELS[item.shortCategory] ?? item.shortCategory,
            recordCount: item.recordCount,
          }
        }),
      )
      return resolved
    },
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 20,
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
      threatenedSpecies: threatenedSpeciesQuery.data ?? [],
      categoryBreakdown,
    }
  }, [speciesCountsQuery.data, threatenedSpeciesQuery.data])

  // ── Hero species extras: multilingual common names from /vernacularNames.
  const heroSpeciesKey = topSpeciesData[0]?.id
    ? Number(topSpeciesData[0].id)
    : undefined

  const heroExtrasQuery = useQuery({
    queryKey: ['heroExtras', heroSpeciesKey],
    queryFn: async ({ signal }) => {
      if (!heroSpeciesKey || !Number.isFinite(heroSpeciesKey)) return null
      const vernaculars = await fetchSpeciesVernacularNames({
        speciesKey: heroSpeciesKey,
        signal,
      })
      return { vernaculars: vernaculars.results }
    },
    enabled: Boolean(heroSpeciesKey),
    staleTime: 1000 * 60 * 60,
  })

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
    const list = heroExtrasQuery.data?.vernaculars ?? []
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
  }, [heroExtrasQuery.data])

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

  const totalRecords = facetsQuery.data?.count ?? 0
  const updatedAt = facetsQuery.dataUpdatedAt
    ? new Date(facetsQuery.dataUpdatedAt).toLocaleTimeString()
    : '—'

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

  return {
    seasonalityData,
    yearTrendData,
    topSpeciesData,
    inSeasonSpecies,
    smallWondersSpecies,
    conservationSnapshot,
    kingdomBreakdown,
    classBreakdown,
    datasetSummaries,
    totalRecords,
    updatedAt,
    maxSeasonality,
    maxTrend,
    multilingualNames,
    recordsBreakdown,
  }
}
