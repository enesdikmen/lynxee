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
  classGroup?: string
  popularity?: number
  isOverallTop?: boolean
  hasImage?: boolean
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

export type DatasetSummary = {
  key: string
  title: string
  doi?: string
  publisher?: string
  license?: string
}
