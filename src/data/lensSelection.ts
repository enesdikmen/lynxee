/**
 * Content-selection registry for bento cards.
 *
 * Design contract:
 * - Keep selection rules centralized here (do not hardcode them in hooks/pages).
 * - Use one poster seed to pick among top-N candidates deterministically.
 * - Add new 2x1/hero variants by extending this file first.
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
  // Filters are tried in order until we get species picks.
  filters: TaxonFilter[]
  // Pick from top N species for this slot (seeded); 1 keeps deterministic top hit.
  pickFromTop: number
}

// Central selection registry for the 6-slot gallery.
export const HERO_SLOT_RULES: HeroSlotRule[] = [
  {
    id: 'mammal',
    label: 'Mammal',
    filters: [{ classKey: 359 }, { classKey: 358 }, { classKey: 131 }],
    pickFromTop: 3,
  },
  { id: 'bird', label: 'Bird', filters: [{ classKey: 212 }], pickFromTop: 1 },
  { id: 'insect', label: 'Insect', filters: [{ classKey: 216 }], pickFromTop: 1 },
  {
    id: 'flower',
    label: 'Flowering plant',
    filters: [{ classKey: 220 }],
    pickFromTop: 1,
  },
  {
    id: 'tree-fern',
    label: 'Tree or fern',
    filters: [{ classKey: 194 }, { classKey: 7228684 }, { classKey: 196 }],
    pickFromTop: 1,
  },
  {
    id: 'fungus',
    label: 'Fungus',
    filters: [{ kingdomKey: 5 }],
    pickFromTop: 1,
  },
]

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

export type BrandNewRule = {
  candidateLimit: number
  maxYearChecks: number
  yearFacetLimit: number
  stripSize: number
  recentYearsWindow: number
}

export const BRAND_NEW_RULE: BrandNewRule = {
  // Keep this modest: each candidate may trigger an additional year-facet call.
  candidateLimit: 8,
  maxYearChecks: 6,
  yearFacetLimit: 250,
  stripSize: 3,
  recentYearsWindow: 5,
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
    { label: 'Owl', filter: { familyKey: 9348 } },
    { label: 'Moth', filter: { familyKey: 7015 } },
    { label: 'Moth', filter: { familyKey: 6950 } },
    { label: 'Moth', filter: { familyKey: 4532185 } },
  ],
}
