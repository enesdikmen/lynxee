import type { ImageSource } from '../../api/speciesImage'
import type {
  BreakdownItem,
  ConservationSnapshot,
  DatasetSummary,
  SpeciesCard,
  ThematicStripCard,
} from '../../types/lens'
import type { SignatureSpeciesCard } from './signatureSpecies'

export type RecordsBreakdownItem = {
  key: string
  label: string
  hint: string
  count: number
  share: number
}

export type YearCount = { year: number; count: number }

export type YearSummary = {
  firstYear: number
  peakYear: number
  peakYearCount: number
  /** Per-year observation counts, sorted chronologically. */
  yearCounts: YearCount[]
}

export type LensData = {
  /** True when all queries needed for a stable poster snapshot are settled. */
  isReady: boolean
  seasonalityData: number[]
  yearSummary: YearSummary | null
  topSpeciesData: SpeciesCard[]
  thematicStripCards: ThematicStripCard[]
  conservationSnapshot: ConservationSnapshot
  kingdomBreakdown: BreakdownItem[]
  datasetSummaries: DatasetSummary[]
  totalRecords: number
  maxSeasonality: number
  multilingualNames: { language: string; name: string }[]
  recordsBreakdown: RecordsBreakdownItem[]
  /** Live-computed signature species (over-represented vs global baseline).
   *  A small pool (after cross-lens dedupe) of candidates ranked by
   *  `localShare / globalShare`. The signature-species card picks one at
   *  random from this list. Empty while loading, undersampled, or
   *  fully claimed by higher-priority lenses. */
  signatureSpeciesData: SignatureSpeciesCard[]
}

export type UseLensDataOptions = {
  imageSources?: ImageSource[]
  contentSeed?: number
  /** Disable all network work for this hook instance. */
  enabled?: boolean
}
