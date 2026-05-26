import { useState } from 'react'
import BentoPoster from './pages/BentoPoster'
import { places } from './data/lensFallbacks'
import type { Place } from './types/lens'
import { ALL_IMAGE_SOURCES, type ImageSource } from './api/speciesImage'

/** Ordered list of image sources. The order is the fallback priority used
 *  by `resolveSpeciesImage`; the `active` flag controls whether the source
 *  is consulted at all. Active and priority are independently editable. */
export type ImageSourceConfig = Array<{ source: ImageSource; active: boolean }>

function App() {
  const [selectedPlace, setSelectedPlace] = useState<Place>(places[0])
  const [imageSourceConfig, setImageSourceConfig] = useState<ImageSourceConfig>(
    () => ALL_IMAGE_SOURCES.map((source) => ({ source, active: true })),
  )

  return (
    <div className="theme-playful text-ink">
      <BentoPoster
        selectedPlace={selectedPlace}
        onPlaceChange={setSelectedPlace}
        imageSourceConfig={imageSourceConfig}
        onImageSourceConfigChange={setImageSourceConfig}
      />
    </div>
  )
}

export default App
