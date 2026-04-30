import { useState } from 'react'
import GridSandbox from './pages/GridSandbox'
import BentoPoster from './pages/BentoPoster'
import { places } from './data/lensFallbacks'
import type { Place } from './types/lens'
import { ALL_IMAGE_SOURCES, type ImageSource } from './api/speciesImage'

function App() {
  const [page, setPage] = useState<'main' | 'sandbox'>('main')
  const [selectedPlace, setSelectedPlace] = useState<Place>(places[0])
  // Image source toggles. The order in this array also defines the
  // fallback priority used by `resolveSpeciesImage`.
  const [imageSources, setImageSources] =
    useState<ImageSource[]>(ALL_IMAGE_SOURCES)

  if (page === 'sandbox') {
    return <GridSandbox onBack={() => setPage('main')} />
  }

  return (
    <div className="theme-playful text-ink">
      <BentoPoster
        selectedPlace={selectedPlace}
        onPlaceChange={setSelectedPlace}
        imageSources={imageSources}
        onImageSourcesChange={setImageSources}
        onOpenSandbox={() => setPage('sandbox')}
      />
    </div>
  )
}

export default App
