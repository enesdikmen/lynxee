import { useMemo, useState } from 'react'
import './App.css'
import LensBreakdown from './components/LensBreakdown'
import LensHeader from './components/LensHeader'
import LensMainPanels from './components/LensMainPanels'
import { places } from './data/lensFallbacks'
import { useLensData } from './hooks/useLensData'

function App() {
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0]?.id ?? '')
  const [onlyWithImages, setOnlyWithImages] = useState(false)
  // Support non-root deployments (e.g., GitHub Pages) for sticker assets.
  const stickerBase = import.meta.env.BASE_URL ?? '/'
  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? places[0],
    [selectedPlaceId],
  )

  const {
    seasonalityData,
    yearTrendData,
    topSpeciesData,
    conservationSnapshot,
    kingdomBreakdown,
    classBreakdown,
    datasetSummaries,
    totalRecords,
    updatedAt,
    maxSeasonality,
    maxTrend,
    maxKingdom,
    maxClass,
  } = useLensData(selectedPlace, { onlyWithImages })

  return (
    <div className="theme-playful text-ink">
      <div className="poster-shell">
        <div className="poster-frame">
          <main className="poster-canvas">
            <div className="collage-flow">
              <div className="collage-section collage-section--header">
                <span className="collage-tape collage-tape--left" />
                <span className="collage-tape collage-tape--right" />
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
                  onlyWithImages={onlyWithImages}
                  onToggleOnlyWithImages={(event) =>
                    setOnlyWithImages(event.target.checked)
                  }
                  stickerBase={stickerBase}
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
                      value: totalRecords
                        ? topSpeciesData.length.toString()
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
                  conservationSnapshot={conservationSnapshot}
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
