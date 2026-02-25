import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import './App.css'
import {
  fetchDatasetMetadata,
  fetchOccurrenceFacets,
  fetchSpecies,
  fetchSpeciesMedia,
} from './api/gbif'
import LensBreakdown from './components/LensBreakdown'
import LensHeader from './components/LensHeader'
import LensMainPanels from './components/LensMainPanels'

type Place = {
  id: string
  label: string
  country: string
  latitude: number
  longitude: number
  radiusKm: number
}

type SpeciesCard = {
  id: string
  commonName: string
  scientificName: string
  imageUrl: string
  highlight: string
  taxonLine?: string
}

type DatasetSummary = {
  key: string
  title: string
  doi?: string
  publisher?: string
  license?: string
}

const places: Place[] = [
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
]

const fallbackTopSpecies: SpeciesCard[] = [
  {
    id: 's1',
    commonName: 'European Robin',
    scientificName: 'Erithacus rubecula',
    imageUrl: 'https://placehold.co/320x220/fed7aa/1f2937?text=Robin',
    highlight: 'Peak in spring gardens',
    taxonLine: 'Animalia · Chordata · Aves',
  },
  {
    id: 's2',
    commonName: 'Great Tit',
    scientificName: 'Parus major',
    imageUrl: 'https://placehold.co/320x220/bbf7d0/1f2937?text=Great+Tit',
    highlight: 'Top urban songbird',
    taxonLine: 'Animalia · Chordata · Aves',
  },
  {
    id: 's3',
    commonName: 'Common Swift',
    scientificName: 'Apus apus',
    imageUrl: 'https://placehold.co/320x220/bae6fd/1f2937?text=Swift',
    highlight: 'Summer aerial flocks',
    taxonLine: 'Animalia · Chordata · Aves',
  },
  {
    id: 's4',
    commonName: 'European Hedgehog',
    scientificName: 'Erinaceus europaeus',
    imageUrl: 'https://placehold.co/320x220/fcd34d/1f2937?text=Hedgehog',
    highlight: 'Night sightings rise',
    taxonLine: 'Animalia · Chordata · Mammalia',
  },
  {
    id: 's5',
    commonName: 'Mallard',
    scientificName: 'Anas platyrhynchos',
    imageUrl: 'https://placehold.co/320x220/fecaca/1f2937?text=Mallard',
    highlight: 'Stable year-round',
    taxonLine: 'Animalia · Chordata · Aves',
  },
  {
    id: 's6',
    commonName: 'Small White',
    scientificName: 'Pieris rapae',
    imageUrl: 'https://placehold.co/320x220/c7d2fe/1f2937?text=Butterfly',
    highlight: 'Summer peak',
    taxonLine: 'Animalia · Arthropoda · Insecta',
  },
]

const fallbackSeasonality = [
  18, 24, 32, 48, 68, 82, 74, 60, 44, 30, 22, 16,
]

const fallbackYearTrend = [
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

const fallbackKingdomBreakdown = [
  { label: 'Animalia', count: 14800 },
  { label: 'Plantae', count: 8200 },
  { label: 'Fungi', count: 1600 },
  { label: 'Chromista', count: 420 },
  { label: 'Bacteria', count: 210 },
]

const fallbackClassBreakdown = [
  { label: 'Aves', count: 6100 },
  { label: 'Insecta', count: 4400 },
  { label: 'Mammalia', count: 1300 },
  { label: 'Magnoliopsida', count: 3200 },
]

const fallbackIucnSummary = [
  { status: 'LC', label: 'Least concern', count: 182 },
  { status: 'NT', label: 'Near threatened', count: 26 },
  { status: 'VU', label: 'Vulnerable', count: 18 },
  { status: 'EN', label: 'Endangered', count: 9 },
  { status: 'CR', label: 'Critically endangered', count: 4 },
  { status: 'DD', label: 'Data deficient', count: 31 },
]

const IUCN_LABELS: Record<string, string> = {
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

function App() {
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0]?.id ?? '')
  const stickerBase = import.meta.env.BASE_URL ?? '/'
  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? places[0],
    [selectedPlaceId],
  )

  const facetsQuery = useQuery({
    queryKey: ['occurrenceFacets', selectedPlace?.id],
    queryFn: ({ signal }) =>
      fetchOccurrenceFacets({
        latitude: selectedPlace?.latitude ?? 0,
        longitude: selectedPlace?.longitude ?? 0,
        radiusKm: selectedPlace?.radiusKm ?? 0,
        facetFields: [
          'month',
          'year',
          'speciesKey',
          'datasetKey',
          'iucnRedListCategory',
          'kingdomKey',
          'classKey',
        ],
        facetLimit: 12,
        signal,
      }),
    enabled: Boolean(selectedPlace),
    staleTime: 1000 * 60 * 10,
  })

  const facetsSummary = useMemo(() => {
    if (!facetsQuery.data) return null

    const normalizeField = (value: string) =>
      value.replace(/_/g, '').toLowerCase()

    const facetsByField = facetsQuery.data.facets.reduce(
      (acc, facet) => {
        acc[normalizeField(facet.field)] = facet
        return acc
      },
      {} as Record<string, { counts: { name: string; count: number }[] }>,
    )

    const getCounts = (field: string) =>
      facetsByField[normalizeField(field)]?.counts ?? []

    return {
      month: getCounts('month'),
      year: getCounts('year'),
      speciesKey: getCounts('speciesKey'),
      datasetKey: getCounts('datasetKey'),
      iucn: getCounts('iucnRedListCategory'),
      kingdomKey: getCounts('kingdomKey'),
      classKey: getCounts('classKey'),
    }
  }, [facetsQuery.data])

  const seasonalityData = useMemo(() => {
    if (!facetsSummary?.month?.length) return fallbackSeasonality
    const countsByMonth = facetsSummary.month.reduce<Record<number, number>>(
      (acc, item) => {
        const parsed = Number(item.name)
        if (Number.isFinite(parsed)) acc[parsed] = item.count
        return acc
      },
      {},
    )
    return Array.from({ length: 12 }, (_, index) =>
      countsByMonth[index + 1] ?? 0,
    )
  }, [facetsSummary])

  const yearTrendData = useMemo(() => {
    if (!facetsSummary?.year?.length) return fallbackYearTrend
    return facetsSummary.year
      .map((item) => ({
        year: Number(item.name),
        count: item.count,
      }))
      .filter((item) => Number.isFinite(item.year))
      .sort((a, b) => a.year - b.year)
  }, [facetsSummary])

  const speciesKeys = useMemo(() => {
    if (!facetsSummary?.speciesKey?.length) return []
    return facetsSummary.speciesKey
      .map((item) => Number(item.name))
      .filter((value) => Number.isFinite(value))
      .slice(0, 6)
  }, [facetsSummary])

  const topSpeciesQuery = useQuery({
    queryKey: ['topSpecies', speciesKeys],
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        speciesKeys.map(async (speciesKey) => {
          const species = await fetchSpecies({ speciesKey, signal })
          const media = await fetchSpeciesMedia({
            speciesKey,
            limit: 1,
            signal,
          })
          const mediaItem = media.results.find(
            (item) => item.identifier || item.references,
          )
          const imageUrl =
            mediaItem?.identifier ??
            mediaItem?.references ??
            'https://placehold.co/320x220/f3f4f6/1f2937?text=No+image'
          return {
            id: String(speciesKey),
            commonName:
              species.vernacularName ??
              species.canonicalName ??
              species.scientificName,
            scientificName: species.scientificName,
            imageUrl,
            highlight: species.rank
              ? `${species.rank} · ${species.kingdom ?? 'GBIF'}`
              : 'GBIF species',
            taxonLine: [
              species.kingdom,
              species.phylum,
              species.class,
            ]
              .filter(Boolean)
              .join(' · '),
          }
        }),
      )
      return results
    },
    enabled: speciesKeys.length > 0,
    staleTime: 1000 * 60 * 20,
  })

  const topSpeciesData = topSpeciesQuery.data ?? fallbackTopSpecies

  const iucnSummaryData = useMemo(() => {
    if (!facetsSummary?.iucn?.length) return fallbackIucnSummary
    return facetsSummary.iucn.map((item) => ({
      status: item.name,
      label: IUCN_LABELS[item.name] ?? 'Unknown',
      count: item.count,
    }))
  }, [facetsSummary])

  const kingdomKeys = useMemo(
    () =>
      facetsSummary?.kingdomKey
        ?.map((item) => Number(item.name))
        .filter((value) => Number.isFinite(value))
        .slice(0, 5) ?? [],
    [facetsSummary],
  )

  const classKeys = useMemo(
    () =>
      facetsSummary?.classKey
        ?.map((item) => Number(item.name))
        .filter((value) => Number.isFinite(value))
        .slice(0, 5) ?? [],
    [facetsSummary],
  )

  const taxonKeys = useMemo(() => {
    const merged = new Set<number>()
    kingdomKeys.forEach((key) => merged.add(key))
    classKeys.forEach((key) => merged.add(key))
    return Array.from(merged)
  }, [kingdomKeys, classKeys])

  const taxonLabelsQuery = useQuery({
    queryKey: ['taxonLabels', taxonKeys],
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(
        taxonKeys.map(async (key) => {
          const species = await fetchSpecies({ speciesKey: key, signal })
          return [
            key,
            species.canonicalName ?? species.scientificName ?? `Key ${key}`,
          ] as const
        }),
      )
      return Object.fromEntries(entries)
    },
    enabled: taxonKeys.length > 0,
    staleTime: 1000 * 60 * 60,
  })

  const kingdomBreakdown = useMemo(() => {
    if (!facetsSummary?.kingdomKey?.length) return fallbackKingdomBreakdown
    return facetsSummary.kingdomKey
      .slice(0, 5)
      .map((item) => {
        const key = Number(item.name)
        return {
          label: taxonLabelsQuery.data?.[key] ?? `Key ${item.name}`,
          count: item.count,
        }
      })
  }, [facetsSummary, taxonLabelsQuery.data])

  const classBreakdown = useMemo(() => {
    if (!facetsSummary?.classKey?.length) return fallbackClassBreakdown
    return facetsSummary.classKey
      .slice(0, 5)
      .map((item) => {
        const key = Number(item.name)
        return {
          label: taxonLabelsQuery.data?.[key] ?? `Key ${item.name}`,
          count: item.count,
        }
      })
  }, [facetsSummary, taxonLabelsQuery.data])

  const datasetKeys = useMemo(() => {
    if (!facetsSummary?.datasetKey?.length) return []
    return facetsSummary.datasetKey
      .slice(0, 3)
      .map((item) => item.name)
  }, [facetsSummary])

  const datasetQuery = useQuery({
    queryKey: ['topDatasets', datasetKeys],
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        datasetKeys.map((datasetKey) =>
          fetchDatasetMetadata({ datasetKey, signal }),
        ),
      )
      return results
    },
    enabled: datasetKeys.length > 0,
    staleTime: 1000 * 60 * 60,
  })

  const datasetSummaries: DatasetSummary[] =
    datasetQuery.data
      ?.map((dataset) => ({
        key: dataset.key,
        title: dataset.title,
        doi: dataset.doi,
        publisher: dataset.publisher,
        license: dataset.license,
      }))
      .filter((dataset) => dataset.title) ?? []

  const maxSeasonality = useMemo(
    () => Math.max(...seasonalityData, 1),
    [seasonalityData],
  )
  const maxTrend = useMemo(
    () => Math.max(...yearTrendData.map((item) => item.count), 1),
    [yearTrendData],
  )
  const maxKingdom = useMemo(
    () => Math.max(...kingdomBreakdown.map((item) => item.count), 1),
    [kingdomBreakdown],
  )
  const maxClass = useMemo(
    () => Math.max(...classBreakdown.map((item) => item.count), 1),
    [classBreakdown],
  )

  const totalRecords = facetsQuery.data?.count ?? 0
  const updatedAt = facetsQuery.dataUpdatedAt
    ? new Date(facetsQuery.dataUpdatedAt).toLocaleTimeString()
    : '—'

  return (
    <div className="theme-playful text-ink">
      <div className="poster-shell">
        <div className="poster-frame">
          <main className="poster-canvas">
            <div className="collage-flow">
              <div className="collage-section collage-section--header">
                <span className="collage-tape collage-tape--left" />
                <span className="collage-tape collage-tape--right" />
                <span className="collage-sticker collage-sticker--leaf">
                  <img src={`${stickerBase}leaf.svg`} alt="Leaf sticker" />
                </span>
                <span className="collage-sticker collage-sticker--leaf-2">
                  <img src={`${stickerBase}leaf.svg`} alt="Leaf sticker" />
                </span>
                <span className="collage-sticker collage-sticker--sun">
                  <img src={`${stickerBase}sun.svg`} alt="Sunny sticker" />
                </span>
                <span className="collage-sticker collage-sticker--sun-2">
                  <img src={`${stickerBase}sun.svg`} alt="Sunny sticker" />
                </span>
                <LensHeader
                  title={`${selectedPlace?.label ?? 'Pick a place'} biodiversity portrait`}
                  description="Static layout preview for the first data lens. Placeholder values show what each panel will contain."
                  places={places.map((place) => ({
                    id: place.id,
                    label: place.label,
                  }))}
                  selectedPlaceId={selectedPlaceId}
                  onChangePlace={(event) =>
                    setSelectedPlaceId(event.target.value)
                  }
                  placeDetails={
                    selectedPlace
                      ? {
                          label: selectedPlace.label,
                          latitude: selectedPlace.latitude,
                          longitude: selectedPlace.longitude,
                          radiusKm: selectedPlace.radiusKm,
                        }
                      : undefined
                  }
                  stats={[
                    {
                      label: 'Records used',
                      value: totalRecords ? totalRecords.toLocaleString() : '—',
                    },
                    {
                      label: 'Top species in view',
                      value: speciesKeys.length
                        ? speciesKeys.length.toString()
                        : '—',
                    },
                    { label: 'Last refresh', value: updatedAt },
                  ]}
                />
              </div>

              <div className="collage-section collage-section--main">
                <span className="collage-tape collage-tape--center" />
                <span className="collage-tape collage-tape--short" />
                <span className="collage-sticker collage-sticker--bug">
                  <img src={`${stickerBase}beetle.svg`} alt="Beetle sticker" />
                </span>
                <span className="collage-sticker collage-sticker--bug-2">
                  <img src={`${stickerBase}beetle.svg`} alt="Beetle sticker" />
                </span>
                <LensMainPanels
                  topSpecies={topSpeciesData}
                  iucnSummary={iucnSummaryData}
                  seasonality={seasonalityData}
                  maxSeasonality={maxSeasonality}
                  yearTrend={yearTrendData}
                  maxTrend={maxTrend}
                />
              </div>

              <div className="collage-section collage-section--breakdown">
                <span className="collage-tape collage-tape--tilt" />
                <span className="collage-sticker collage-sticker--drop">
                  <img src={`${stickerBase}water.svg`} alt="Water drop sticker" />
                </span>
                <span className="collage-sticker collage-sticker--drop-2">
                  <img src={`${stickerBase}water.svg`} alt="Water drop sticker" />
                </span>
                <span className="collage-sticker collage-sticker--mushroom">
                  <img src={`${stickerBase}mushroom.svg`} alt="Mushroom sticker" />
                </span>
                <span className="collage-sticker collage-sticker--mushroom-2">
                  <img src={`${stickerBase}mushroom.svg`} alt="Mushroom sticker" />
                </span>
                <LensBreakdown
                  kingdomBreakdown={kingdomBreakdown}
                  classBreakdown={classBreakdown}
                  maxKingdom={maxKingdom}
                  maxClass={maxClass}
                  placeLabel={selectedPlace?.label}
                  totalRecords={totalRecords}
                  datasetSummaries={datasetSummaries}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
