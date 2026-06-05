/**
 * Content-selection registry for bento cards.
 *
 * Design contract:
 * - Keep selection rules centralized here (do not hardcode them in hooks/pages).
 * - Use one poster seed to pick among top-N candidates deterministically.
 * - Add new 2x1/hero variants by extending this file first.
 *
 * Cross-lens species uniqueness:
 *   Each lens hook (top species / conservation / thematic) produces its own
 *   candidate pool independently. To avoid the same species appearing in
 *   two cards, a single dedup pass runs at the end of `useLensData`
 *   (`hooks/lensData/dedupe.ts`) and walks the pools in a fixed priority:
 *
 *     1. topSpeciesData        (hero + minis)        — claims everything
 *     2. threatenedSpecies     (atRisk)              — claims its rendered pick
 *     3. thematicStripCards[*] (themed strips)       — claims each strip's [0]
 *
 *   Every lens therefore exposes a *list* of candidates (not just the one
 *   it currently renders) so that lower-priority slots can fall through to
 *   the next candidate without a refetch. When adding a new selection
 *   rule, decide its priority and add it to the dedup chain.
 */
export type TaxonFilter = {
  classKey?: number
  kingdomKey?: number
  orderKey?: number
  familyKey?: number
  speciesKey?: number
}

export type HeroSlotRule = {
  id: string
  label: string
  /** Filters are tried in order until we get species picks. */
  filters: TaxonFilter[]
  /** Pick from top N species for this slot (seeded). Defaults to {@link DEFAULT_PICK_FROM_TOP}. */
  pickFromTop?: number
}

/** How many top candidates to fetch per hero slot for seeded rotation. */
export const DEFAULT_PICK_FROM_TOP = 3

/**
 * A candidate must have at least this fraction of the slot's top candidate's
 * observation count to be eligible for seeded rotation.  Keeps sparse-place
 * slots from surfacing near-zero-observation species.
 */
export const MIN_COUNT_RATIO = 0.1

/**
 * Always keep at least this many top candidates per slot regardless of the
 * ratio filter, so a single dominant species can't collapse the slot to one
 * pick (e.g. a heavily-recorded bat in France). The ratio filter still trims
 * anything past this floor.
 */
export const MIN_VIABLE_CANDIDATES = 2

export const HERO_SLOT_RULES: HeroSlotRule[] = [
  {
    id: 'mammal',
    label: 'Mammal',
    filters: [{ classKey: 359 }, { classKey: 358 }, { classKey: 131 }],
  },
  { id: 'bird', label: 'Bird', filters: [{ classKey: 212 }] },
  { id: 'insect', label: 'Insect', filters: [{ classKey: 216 }] },
  { id: 'flower', label: 'Flowering plant', filters: [{ classKey: 220 }] },
  {
    id: 'tree-fern',
    label: 'Tree or fern',
    filters: [{ classKey: 194 }, { classKey: 7228684 }, { classKey: 196 }],
  },
  { id: 'fungus', label: 'Fungus', filters: [{ kingdomKey: 5 }] },
]

/**
 * Extra mini-square pool for underrepresented taxonomic groups.
 * Two different categories are selected per poster (seeded) when available.
 */
export const EXTRA_MINI_SLOT_RULES: HeroSlotRule[] = [
  { id: 'reptile', label: 'Reptile', filters: [{ classKey: 358 }] },
  { id: 'amphibian', label: 'Amphibian', filters: [{ classKey: 131 }] },
  { id: 'fish', label: 'Fish', filters: [{ classKey: 204 }] },
  { id: 'arachnid', label: 'Arachnid', filters: [{ classKey: 367 }] },
]

/** Number of extra mini species cards to add from EXTRA_MINI_SLOT_RULES. */
export const EXTRA_MINI_SLOT_COUNT = 2

/** How many mini species tiles the fixed poster layout renders. */
export const SPECIES_MINI_COUNT = 7

/** Used to keep top-species pools sufficiently sized. */
export const MAX_SPECIES_MINI_COUNT = SPECIES_MINI_COUNT

export type InSeasonRule = {
  facetLimit: number
  stripSize: number
  highlight: string
}

export const IN_SEASON_RULE: InSeasonRule = {
  facetLimit: 5,
  stripSize: 3,
  highlight: 'Recorded this month',
}

export type SmallWondersSourceRule = {
  label: string
  filter: TaxonFilter
}

export type SmallWondersRule = {
  facetLimit: number
  stripSize: number
  sources: SmallWondersSourceRule[]
}

export const SMALL_WONDERS_RULE: SmallWondersRule = {
  facetLimit: 5,
  stripSize: 3,
  sources: [
    { label: 'Insect', filter: { classKey: 216 } },
    { label: 'Fungus', filter: { kingdomKey: 5 } },
  ],
}

export type NightCreaturesRule = {
  facetLimit: number
  stripSize: number
  sources: SmallWondersSourceRule[]
}

export const NIGHT_CREATURES_RULE: NightCreaturesRule = {
  facetLimit: 5,
  stripSize: 3,
  sources: [
    { label: 'Bat', filter: { orderKey: 734 } },
    { label: 'Owl', filter: { orderKey: 1450 } },
    { label: 'Nightjar', filter: { familyKey: 5225 } },
    { label: 'Frogmouth', filter: { familyKey: 9337 } },
    { label: 'Potoo', filter: { familyKey: 9324 } },
    { label: 'Oilbird', filter: { familyKey: 9346 } },
    { label: 'Moth', filter: { familyKey: 7015 } },
    { label: 'Moth', filter: { familyKey: 6950 } },
    { label: 'Moth', filter: { familyKey: 4532185 } },
    { label: 'Hawk moth', filter: { familyKey: 8868 } },
    { label: 'Moth', filter: { familyKey: 8841 } },
    { label: 'Firefly', filter: { familyKey: 4737 } },
  ],
}
