export type Place = {
  id: string
  label: string
  country: string
  latitude: number
  longitude: number
  radiusKm: number
}

export type SpeciesCard = {
  id: string
  commonName: string
  scientificName: string
  imageUrl: string
  highlight: string
  taxonLine?: string
  popularity?: number
}

export type YearTrendPoint = {
  year: number
  count: number
}

export type BreakdownItem = {
  label: string
  count: number
}

export type IucnStatus = {
  status: string
  label: string
  count: number
}

export type ThreatenedSpecies = {
  speciesKey: number
  commonName: string
  scientificName: string
  imageUrl?: string
  iucnCategory: 'CR' | 'EN' | 'VU'
  iucnLabel: string
  recordCount: number
}

export type ConservationSnapshot = {
  totalAssessedSpecies: number
  threatenedCount: number
  threatenedPercent: number
  threatenedSpecies: ThreatenedSpecies[]
  categoryBreakdown: IucnStatus[]
}

export type DatasetSummary = {
  key: string
  title: string
  doi?: string
  publisher?: string
  license?: string
}
