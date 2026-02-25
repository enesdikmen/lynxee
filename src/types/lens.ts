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
