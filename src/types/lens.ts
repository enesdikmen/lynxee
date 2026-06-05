import type { ImageSource } from '../api/speciesImage'

export type PlaceBBox = {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

export type Place = {
  id: string
  label: string
  country: string
  /** ISO-2 country code (uppercase), when available. */
  countryCode?: string
  latitude: number
  longitude: number
  /** Fallback radius (km) used when no bbox is available. */
  radiusKm: number
  /** Real bounding box of the city/admin area (from Nominatim). */
  bbox?: PlaceBBox
}

export type SpeciesCard = {
  id: string
  commonName: string
  scientificName: string
  /** Binomial without authorship — used for image lookups (e.g. iNaturalist). */
  canonicalName?: string
  imageUrl: string
  /** Pre-cropped 1:1 thumbnail for square strip tiles; falls back to imageUrl. */
  squareImageUrl?: string
  /** Source that provided the currently shown image. */
  imageSource?: ImageSource
  highlight: string
  taxonLine?: string
  popularity?: number
}

export type ThematicStripCard = {
  id: 'inSeason' | 'smallWonders' | 'nightCreatures'
  kicker: string
  species: SpeciesCard[]
}

export type BreakdownItem = {
  label: string
  count: number
}

export type IucnBucket = {
  status: string
  label: string
  count: number
}

export type ThreatenedSpecies = SpeciesCard & {
  iucnCategory: 'CR' | 'EN' | 'VU'
  iucnLabel: string
}

export type ConservationSnapshot = {
  totalAssessedSpecies: number
  threatenedCount: number
  threatenedPercent: number
  categoryBreakdown: IucnBucket[]
  threatenedSpecies: ThreatenedSpecies[]
}

export type DatasetSummary = {
  key: string
  title: string
  /** Number of matching occurrence records in the current place snapshot. */
  occurrenceCount?: number
  doi?: string
  publisher?: string
  license?: string
}
