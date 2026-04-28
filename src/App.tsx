import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'
import GridSandbox from './pages/GridSandbox'
import VineDecoration from './components/decorations/VineDecoration'
import { DoodleSparkle } from './components/decorations/Doodles'
import SpeciesGallery from './components/SpeciesGallery'
import LensStrip from './components/LensStrip'
import DataIllustrations from './components/DataIllustrations'
import TaxonomyFooter from './components/TaxonomyFooter'
import HowWeKnow from './components/HowWeKnow'
import BranchDivider from './components/BranchDivider'
import { places } from './data/lensFallbacks'
import { useLensData } from './hooks/useLensData'

function App() {
  const [page, setPage] = useState<'main' | 'sandbox'>('main')
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0]?.id ?? '')
  const [onlyWithImages, setOnlyWithImages] = useState(false)
  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? places[0],
    [selectedPlaceId],
  )

  const {
    seasonalityData, yearTrendData, topSpeciesData, conservationSnapshot,
    kingdomBreakdown, classBreakdown, datasetSummaries,
    totalRecords, updatedAt, maxSeasonality, maxTrend,
    multilingualNames, recordsBreakdown,
    inSeasonSpecies, smallWondersSpecies,
  } = useLensData(selectedPlace, { onlyWithImages })

  // One-line "what life looks like here" sentence built from kingdom counts.
  // Replaces the old row of taxonomy bubbles which was visual noise for non-experts.
  const kingdomSentence = useMemo(() => {
    if (!kingdomBreakdown.length) return ''
    const total = kingdomBreakdown.reduce((s, k) => s + k.count, 0)
    if (total === 0) return ''
    const top = kingdomBreakdown
      .slice(0, 3)
      .map((k) => `${k.label.toLowerCase()} (${Math.round((k.count / total) * 100)}%)`)
    return `Mostly ${top[0]}${top[1] ? `, then ${top[1]}` : ''}${top[2] ? `, with a sprinkle of ${top[2]}` : ''}.`
  }, [kingdomBreakdown])

  // Suppress unused-var warnings for fields we kept on the hook for future use.
  void yearTrendData
  void maxTrend
  void updatedAt
  void classBreakdown

  const placeName = selectedPlace?.label?.split(',')[0]?.trim() ?? 'Pick a place'

  const handlePlaceChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setSelectedPlaceId(e.target.value)

  if (page === 'sandbox') {
    return <GridSandbox onBack={() => setPage('main')} />
  }

  return (
    <div className="theme-playful text-ink">
      <button
        type="button"
        onClick={() => setPage('sandbox')}
        className="lab-btn"
        title="Open layout packer sandbox"
      >
        ⚙ Layout Lab
      </button>
      <div className="poster-shell">
        <div className="poster-frame">
          <main className="poster-canvas">
            <VineDecoration side="left" />
            <VineDecoration side="right" />

            {/* ── HEADLINE ── */}
            <header className="hero-headline">
              <div className="hero-picker">
                <select value={selectedPlaceId} onChange={handlePlaceChange}>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={onlyWithImages}
                    onChange={(e) => setOnlyWithImages(e.target.checked)}
                  />
                  Photos only
                </label>
              </div>

              <span className="hero-headline__kicker">Lynxee Lens</span>
              <h1>
                <span className="hero-headline__place">{placeName}</span>
                <span className="hero-headline__sub">Biodiversity Portrait</span>
              </h1>

              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="hero-stat__value">
                    {totalRecords ? totalRecords.toLocaleString() : '—'}
                  </span>
                  <span className="hero-stat__label">Sightings recorded here</span>
                </div>
              </div>

              {kingdomSentence && (
                <p className="hero-headline__kingdom-line">{kingdomSentence}</p>
              )}

              <HowWeKnow
                totalRecords={totalRecords}
                recordsBreakdown={recordsBreakdown}
              />

              <DoodleSparkle size={24} className="doodle" style={{ top: '0.5rem', left: '8%' }} />
              <DoodleSparkle size={18} color="rgb(var(--color-forest))" className="doodle" style={{ bottom: '0.2rem', right: '12%' }} />
            </header>

            <BranchDivider />

            {/* ── SPECIES GALLERY ── */}
            <SpeciesGallery
              topSpecies={topSpeciesData}
              multilingualNames={multilingualNames}
            />

            <BranchDivider flip />

            {/* ── LENS STRIPS · two compact thematic mini-sections side by side ── */}
            {(inSeasonSpecies.length > 0 || smallWondersSpecies.length > 0) && (
              <>
                <div className="lens-row">
                  {inSeasonSpecies.length > 0 && (
                    <LensStrip
                      species={inSeasonSpecies}
                      kicker={`🌸 In season · ${new Date().toLocaleString('en', { month: 'long' })}`}
                      intro="Most photographed around here this month."
                    />
                  )}
                  {smallWondersSpecies.length > 0 && (
                    <LensStrip
                      species={smallWondersSpecies}
                      kicker="🐛 The small wonders"
                      intro="Insects & fungi — most of life by species count."
                    />
                  )}
                </div>
                <BranchDivider />
              </>
            )}

            {/* ── DATA ILLUSTRATIONS ── */}
            <DataIllustrations
              seasonality={seasonalityData}
              maxSeasonality={maxSeasonality}
              yearTrend={yearTrendData}
              maxTrend={maxTrend}
              conservationSnapshot={conservationSnapshot}
            />

            <BranchDivider />

            {/* ── TAXONOMY + FOOTER ── */}
            <TaxonomyFooter
              placeLabel={selectedPlace?.label}
              totalRecords={totalRecords}
              datasetSummaries={datasetSummaries}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
