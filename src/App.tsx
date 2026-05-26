import { useState } from 'react'
import BentoPoster from './pages/BentoPoster'
import { places } from './data/lensFallbacks'
import { canonicalizePlace, readShareFromLocation } from './lib/shareToken'
import type { Place } from './types/lens'

const initialShare = readShareFromLocation()

function App() {
  const [selectedPlace, setSelectedPlace] = useState<Place>(
    initialShare?.place ?? places[0],
  )

  // Always canonicalize so the sharer's `place.id`/`label` match what a
  // receiver will reconstruct from the URL — this keeps seeded RNG keys
  // (and therefore species picks + card layout) identical across the link.
  const handlePlaceChange = (p: Place) => setSelectedPlace(canonicalizePlace(p))

  return (
    <div className="theme-playful text-ink">
      <BentoPoster
        selectedPlace={selectedPlace}
        onPlaceChange={handlePlaceChange}
        initialSeed={initialShare?.seed}
      />
    </div>
  )
}

export default App
