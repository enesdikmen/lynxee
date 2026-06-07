import { useEffect, useState } from 'react'
import BentoPoster from './pages/BentoPoster'
import AboutPage from './pages/AboutPage'
import { places } from './data/lensFallbacks'
import {
  canonicalizePlace,
  readLanguageFromLocation,
  readLocksFromLocation,
  readShareFromLocation,
} from './lib/shareToken'
import type { Place } from './types/lens'

type AppView = 'poster' | 'about'

const brandLogoSrc = `${import.meta.env.BASE_URL}logo.svg`

const readViewFromLocation = (): AppView =>
  typeof window !== 'undefined' && window.location.hash === '#about'
    ? 'about'
    : 'poster'

const initialShare = readShareFromLocation()
const initialLocks = readLocksFromLocation()
const initialLanguage = readLanguageFromLocation()
const defaultPlace = canonicalizePlace({
  ...places[0],
  // Treat first-load Munich like a searched city so URL/state mirrors
  // selector-driven custom-place behavior (`c.*` token path).
  id: 'default-munich-bootstrap',
})

function App() {
  const [selectedPlace, setSelectedPlace] = useState<Place>(
    initialShare?.place ?? defaultPlace,
  )
  const [view, setView] = useState<AppView>(readViewFromLocation)

  // Always canonicalize so the sharer's `place.id`/`label` match what a
  // receiver will reconstruct from the URL — this keeps seeded RNG keys
  // (and therefore species picks + card layout) identical across the link.
  const handlePlaceChange = (p: Place) => setSelectedPlace(canonicalizePlace(p))

  useEffect(() => {
    const syncView = () => setView(readViewFromLocation())
    window.addEventListener('hashchange', syncView)
    window.addEventListener('popstate', syncView)
    return () => {
      window.removeEventListener('hashchange', syncView)
      window.removeEventListener('popstate', syncView)
    }
  }, [])

  const showView = (nextView: AppView) => {
    if (nextView === 'about') {
      if (window.location.hash !== '#about') window.location.hash = 'about'
      else setView('about')
      return
    }

    const url = new URL(window.location.href)
    url.hash = ''
    window.history.pushState({}, '', url)
    setView('poster')
  }

  return (
    <div className="app-shell theme-playful text-ink">
      <header className="app-header">
        <button type="button" className="app-brand" onClick={() => showView('poster')}>
          <span
            className="app-brand__mark"
            style={{ '--brand-logo-url': `url("${brandLogoSrc}")` } as React.CSSProperties}
          />
          <span className="app-brand__text">
            <span className="app-brand__name">Bee Around</span>
            <span className="app-brand__tag">Biodiversity portraits</span>
          </span>
        </button>
      </header>

      <main className="app-main">
        {view === 'about' ? (
          <AboutPage onBack={() => showView('poster')} />
        ) : (
          <BentoPoster
            selectedPlace={selectedPlace}
            onPlaceChange={handlePlaceChange}
            initialSeed={initialShare?.seed}
            initialLocks={initialLocks}
            initialLanguage={initialLanguage ?? undefined}
            onShowAbout={() => showView('about')}
          />
        )}
      </main>
    </div>
  )
}

export default App
