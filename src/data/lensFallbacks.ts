import type {
  BreakdownItem,
  ConservationSnapshot,
  IucnStatus,
  Place,
  SpeciesCard,
  YearTrendPoint,
} from '../types/lens'

export const places: Place[] = [
  {
    id: 'munich-de',
    label: 'Munich, DE',
    country: 'Germany',
    latitude: 48.137154,
    longitude: 11.576124,
    radiusKm: 35,
  },
  {
    id: 'nairobi-ke',
    label: 'Nairobi, KE',
    country: 'Kenya',
    latitude: -1.292065,
    longitude: 36.821946,
    radiusKm: 45,
  },
  {
    id: 'bogota-co',
    label: 'Bogotá, CO',
    country: 'Colombia',
    latitude: 4.711,
    longitude: -74.0721,
    radiusKm: 55,
  },
  {
    id: 'helsinki-fi',
    label: 'Helsinki, FI',
    country: 'Finland',
    latitude: 60.1699,
    longitude: 24.9384,
    radiusKm: 50,
  },
  {
    id: 'capetown-za',
    label: 'Cape Town, ZA',
    country: 'South Africa',
    latitude: -33.9249,
    longitude: 18.4241,
    radiusKm: 60,
  },
  {
    id: 'singapore-sg',
    label: 'Singapore, SG',
    country: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
    radiusKm: 35,
  },
  {
    id: 'bursa-tr',
    label: 'Bursa, TR',
    country: 'Turkey',
    latitude: 40.1825734,
    longitude: 29.0675039,
    radiusKm: 45,
  },
  {
    id: 'alicante-es',
    label: 'Alicante, ES',
    country: 'Spain',
    latitude: 38.3436365,
    longitude: -0.4881708,
    radiusKm: 40,
  },
]

export const fallbackTopSpecies: SpeciesCard[] = [
  {
    id: 's1',
    commonName: 'European Robin',
    scientificName: 'Erithacus rubecula',
    imageUrl: 'https://placehold.co/320x220/fed7aa/1f2937?text=Robin',
    highlight: 'Peak in spring gardens',
  },
  {
    id: 's2',
    commonName: 'Great Tit',
    scientificName: 'Parus major',
    imageUrl: 'https://placehold.co/320x220/bbf7d0/1f2937?text=Great+Tit',
    highlight: 'Top urban songbird',
  },
  {
    id: 's3',
    commonName: 'Common Swift',
    scientificName: 'Apus apus',
    imageUrl: 'https://placehold.co/320x220/bae6fd/1f2937?text=Swift',
    highlight: 'Summer aerial flocks',
  },
  {
    id: 's4',
    commonName: 'European Hedgehog',
    scientificName: 'Erinaceus europaeus',
    imageUrl: 'https://placehold.co/320x220/fcd34d/1f2937?text=Hedgehog',
    highlight: 'Night sightings rise',
  },
  {
    id: 's5',
    commonName: 'Mallard',
    scientificName: 'Anas platyrhynchos',
    imageUrl: 'https://placehold.co/320x220/fecaca/1f2937?text=Mallard',
    highlight: 'Stable year-round',
  },
  {
    id: 's6',
    commonName: 'Small White',
    scientificName: 'Pieris rapae',
    imageUrl: 'https://placehold.co/320x220/c7d2fe/1f2937?text=Butterfly',
    highlight: 'Summer peak',
  },
]

export const fallbackSeasonality: number[] = [
  18, 24, 32, 48, 68, 82, 74, 60, 44, 30, 22, 16,
]

export const fallbackYearTrend: YearTrendPoint[] = [
  { year: 2016, count: 4200 },
  { year: 2017, count: 4600 },
  { year: 2018, count: 5100 },
  { year: 2019, count: 5900 },
  { year: 2020, count: 4700 },
  { year: 2021, count: 6600 },
  { year: 2022, count: 7200 },
  { year: 2023, count: 7800 },
  { year: 2024, count: 8400 },
]

export const fallbackKingdomBreakdown: BreakdownItem[] = [
  { label: 'Animalia', count: 14800 },
  { label: 'Plantae', count: 8200 },
  { label: 'Fungi', count: 1600 },
  { label: 'Chromista', count: 420 },
  { label: 'Bacteria', count: 210 },
]

export const fallbackClassBreakdown: BreakdownItem[] = [
  { label: 'Aves', count: 6100 },
  { label: 'Insecta', count: 4400 },
  { label: 'Mammalia', count: 1300 },
  { label: 'Magnoliopsida', count: 3200 },
]

export const fallbackIucnSummary: IucnStatus[] = [
  { status: 'LC', label: 'Least concern', count: 182 },
  { status: 'NT', label: 'Near threatened', count: 26 },
  { status: 'VU', label: 'Vulnerable', count: 18 },
  { status: 'EN', label: 'Endangered', count: 9 },
  { status: 'CR', label: 'Critically endangered', count: 4 },
  { status: 'DD', label: 'Data deficient', count: 31 },
]

export const IUCN_LABELS: Record<string, string> = {
  LC: 'Least concern',
  NT: 'Near threatened',
  VU: 'Vulnerable',
  EN: 'Endangered',
  CR: 'Critically endangered',
  DD: 'Data deficient',
  LEAST_CONCERN: 'Least concern',
  NEAR_THREATENED: 'Near threatened',
  VULNERABLE: 'Vulnerable',
  ENDANGERED: 'Endangered',
  CRITICALLY_ENDANGERED: 'Critically endangered',
  DATA_DEFICIENT: 'Data deficient',
  EXTINCT: 'Extinct',
  EXTINCT_IN_THE_WILD: 'Extinct in the wild',
}

export const fallbackConservationSnapshot: ConservationSnapshot = {
  totalAssessedSpecies: 248,
  threatenedCount: 31,
  threatenedPercent: 12.5,
  threatenedSpecies: [
    {
      speciesKey: 0,
      commonName: 'European Eel',
      scientificName: 'Anguilla anguilla',
      iucnCategory: 'CR',
      iucnLabel: 'Critically endangered',
      recordCount: 14,
    },
    {
      speciesKey: 0,
      commonName: 'Greater Horseshoe Bat',
      scientificName: 'Rhinolophus ferrumequinum',
      iucnCategory: 'VU',
      iucnLabel: 'Vulnerable',
      recordCount: 8,
    },
    {
      speciesKey: 0,
      commonName: 'Corn Crake',
      scientificName: 'Crex crex',
      iucnCategory: 'EN',
      iucnLabel: 'Endangered',
      recordCount: 5,
    },
  ],
  categoryBreakdown: [
    { status: 'LC', label: 'Least concern', count: 182 },
    { status: 'NT', label: 'Near threatened', count: 26 },
    { status: 'VU', label: 'Vulnerable', count: 18 },
    { status: 'EN', label: 'Endangered', count: 9 },
    { status: 'CR', label: 'Critically endangered', count: 4 },
    { status: 'DD', label: 'Data deficient', count: 31 },
  ],
}
