import type { ImageSource } from '../../api/speciesImage'
import type {
  BreakdownItem,
  ConservationSnapshot,
  DatasetSummary,
  SpeciesCard,
  ThematicStripCard,
} from '../../types/lens'

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
  imageSources?: ImageSource[]
  contentSeed?: number
}
