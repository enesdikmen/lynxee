/**
 * Live signature species — computes per-place over-representation vs the
 * cached global baseline. Lets the comparison + signature-species cards
 * work for *any* user-selected place, not only the precomputed ones.
 *
 * Inputs:
 *   - one bbox-scoped `fetchOccurrenceFacets` call with `facet=speciesKey`,
 *     `facetLimit=500`. (One extra GBIF call per place.)
 *   - static `global_baseline.json` produced by the precompute notebook
 *     (totalRecords + top 500 global species counts).
 *
 * Output: a small pool (up to 3) of class-diverse signature species.
 * We keep the best species per class first, then fill remaining slots by
 * ratio so the poster is more varied (not only birds) while staying
 * simple and explainable.
 *
 * Caveats:
 *   - We only score species that appear in the top-500 global baseline.
 *     Truly endemic / regional species rarely make that cut, so what
 *     surfaces here is "common-ish species disproportionately observed
 *     here", not strict endemism.
 *   - We require a minimum local total (`MIN_LOCAL_TOTAL`) so tiny,
 *     undersampled bboxes don't produce spurious 100× ratios driven
 *     purely by a single observer's dataset.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchOccurrenceFacets, fetchSpecies } from '../../api/gbif'
import type { Place, SpeciesCard } from '../../types/lens'
import { placeGeoParams } from './shared'
import globalBaselineRaw from '../../global_baseline.json'

type GlobalBaseline = {
  totalRecords: number
  topSpeciesGlobal: { speciesKey: number; count: number }[]
}

const baseline = globalBaselineRaw as GlobalBaseline
const GLOBAL_TOTAL = baseline.totalRecords
const GLOBAL_BY_KEY: Map<number, number> = new Map(
  baseline.topSpeciesGlobal.map((s) => [Number(s.speciesKey), Number(s.count)]),
)

/** Minimum local count of a species for it to be eligible as signature.
 *  Aligned with the precompute notebook so render-time filters never
 *  diverge from what generated the data. */
const MIN_LOCAL_COUNT = 20
/** Minimum total records in the selected place for any ratio to be
 *  trusted. Below this the share denominator is too small and ratios
 *  blow up for trivial reasons. */
const MIN_LOCAL_TOTAL = 2000
const MIN_RATIO = 1.5
/** Final pool size for the poster card. Regenerate picks one from this pool. */
const FINAL_POOL_SIZE = 3
/** How deep we inspect the scored list before applying class-diversity. */
const METADATA_CANDIDATE_POOL = 15
const FACET_LIMIT = 500

export type SignatureSpeciesCard = SpeciesCard & {
  /** localShare / globalShare. >1 means over-represented vs the world. */
  overRepresentationRatio: number
  localCount: number
  globalCount: number
}

export type SignatureSpeciesResult = {
  signatureSpeciesData: SignatureSpeciesCard[]
  isReady: boolean
}

export const useLiveSignatureSpecies = (
  selectedPlace?: Place,
): SignatureSpeciesResult => {
  const query = useQuery({
    queryKey: ['liveSignatureSpecies', selectedPlace?.id],
    queryFn: async ({ signal }): Promise<SignatureSpeciesCard[]> => {
      if (!selectedPlace || GLOBAL_TOTAL <= 0) return []

      const facetResp = await fetchOccurrenceFacets({
        ...placeGeoParams(selectedPlace),
        facetFields: ['speciesKey'],
        facetLimit: FACET_LIMIT,
        signal,
      })

      const localTotal = facetResp.count ?? 0
      if (localTotal < MIN_LOCAL_TOTAL) return []
      const counts = facetResp.facets?.[0]?.counts ?? []
      if (counts.length === 0) return []

      type Scored = {
        speciesKey: number
        localCount: number
        globalCount: number
        ratio: number
      }
      const scored: Scored[] = []
      for (const row of counts) {
        const speciesKey = Number(row.name)
        if (!Number.isFinite(speciesKey)) continue
        const localCount = Number(row.count)
        if (!Number.isFinite(localCount) || localCount < MIN_LOCAL_COUNT) continue
        const globalCount = GLOBAL_BY_KEY.get(speciesKey)
        if (!globalCount || globalCount <= 0) continue

        const localShare = localCount / localTotal
        const globalShare = globalCount / GLOBAL_TOTAL
        if (globalShare <= 0) continue
        const ratio = localShare / globalShare
        if (!Number.isFinite(ratio) || ratio < MIN_RATIO) continue

        scored.push({ speciesKey, localCount, globalCount, ratio })
      }

      scored.sort((a, b) => b.ratio - a.ratio)
      if (scored.length === 0) return []

      const topScored = scored.slice(0, METADATA_CANDIDATE_POOL)
      type ResolvedCandidate = {
        entry: Scored
        species?: Awaited<ReturnType<typeof fetchSpecies>>
      }

      // Resolve metadata for a shallow scored window, then enforce a simple
      // "best-per-class" diversity pass before taking the final top-3 pool.
      const resolved = await Promise.all(
        topScored.map(async (entry): Promise<ResolvedCandidate> => {
          try {
            const species = await fetchSpecies({
              speciesKey: entry.speciesKey,
              signal,
            })
            return { entry, species }
          } catch {
            return { entry }
          }
        }),
      )
      if (resolved.length === 0) return []

      const byRatioDesc = (a: ResolvedCandidate, b: ResolvedCandidate) =>
        b.entry.ratio - a.entry.ratio

      const bestByClass = new Map<string, ResolvedCandidate>()
      for (const candidate of resolved) {
        const classKey = candidate.species?.class?.trim().toLowerCase() || 'unknown'
        const previous = bestByClass.get(classKey)
        if (!previous || candidate.entry.ratio > previous.entry.ratio) {
          bestByClass.set(classKey, candidate)
        }
      }

      const chosen: ResolvedCandidate[] = []
      const chosenSpeciesKeys = new Set<number>()

      for (const candidate of Array.from(bestByClass.values()).sort(byRatioDesc)) {
        chosen.push(candidate)
        chosenSpeciesKeys.add(candidate.entry.speciesKey)
        if (chosen.length >= FINAL_POOL_SIZE) break
      }

      if (chosen.length < FINAL_POOL_SIZE) {
        for (const candidate of resolved) {
          if (chosenSpeciesKeys.has(candidate.entry.speciesKey)) continue
          chosen.push(candidate)
          chosenSpeciesKeys.add(candidate.entry.speciesKey)
          if (chosen.length >= FINAL_POOL_SIZE) break
        }
      }

      return chosen.map(({ entry, species }): SignatureSpeciesCard => {
        const taxonLine = [species?.kingdom, species?.phylum, species?.class]
          .filter(Boolean)
          .join(' · ')

        return {
          id: String(entry.speciesKey),
          commonName:
            species?.vernacularName ??
            species?.canonicalName ??
            species?.scientificName ??
            `Species ${entry.speciesKey}`,
          scientificName: species?.scientificName ?? `Species ${entry.speciesKey}`,
          canonicalName:
            species?.canonicalName ??
            species?.scientificName ??
            `Species ${entry.speciesKey}`,
          imageUrl: '',
          highlight: 'Signature species',
          taxonLine: taxonLine || undefined,
          popularity: entry.localCount,
          overRepresentationRatio: entry.ratio,
          localCount: entry.localCount,
          globalCount: entry.globalCount,
        }
      })
    },
    enabled: Boolean(selectedPlace),
    // Global baseline is static; place facet is moderately expensive.
    staleTime: 1000 * 60 * 30,
  })

  return {
    signatureSpeciesData: query.data ?? [],
    isReady: !selectedPlace || query.isSuccess || query.isError,
  }
}
