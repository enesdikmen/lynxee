import { useEffect, useState } from 'react'
import BentoPoster from './pages/BentoPoster'
import AboutPage from './pages/AboutPage'
import { places } from './data/lensFallbacks'
import {
  canonicalizePlace,
  readLanguageFromLocation,
  readLocksFromLocation,
  readShareFromLocation,
  readThemeFromLocation,
} from './lib/shareToken'
import type { Place } from './types/lens'

type AppView = 'poster' | 'about'
type AppTheme =
  | 'playful'
  | 'canopy'
  | 'prism'
  | 'afterdark'
  | 'acidgarden'
type AppThemeOption = { id: AppTheme; label: string; swatch: string }

const brandLogoSrc = `${import.meta.env.BASE_URL}logo.svg`
const THEME_STORAGE_KEY = 'bee-around-theme'
const THEME_CLASS_BY_ID: Record<AppTheme, string> = {
  playful: 'theme-playful',
  canopy: 'theme-canopy',
  prism: 'theme-prism',
  afterdark: 'theme-afterdark',
  acidgarden: 'theme-acidgarden',
}
const THEME_OPTIONS: AppThemeOption[] = [
  { id: 'playful', label: 'Original', swatch: 'rgb(251 191 36)' },
  { id: 'canopy', label: 'Aqua', swatch: 'rgb(24 198 196)' },
  {
    id: 'prism',
    label: 'Prism',
    swatch:
      'linear-gradient(135deg, rgb(0 190 220) 0 33%, rgb(255 230 0) 33% 66%, rgb(255 71 87) 66% 100%)',
  },
  {
    id: 'afterdark',
    label: 'Afterdark',
    swatch:
      'linear-gradient(135deg, rgb(42 16 84) 0 28%, rgb(255 112 32) 28% 52%, rgb(198 255 0) 52% 76%, rgb(0 224 255) 76% 100%)',
  },
  {
    id: 'acidgarden',
    label: 'Acid Garden',
    swatch:
      'linear-gradient(135deg, rgb(29 88 44) 0 30%, rgb(199 255 24) 30% 55%, rgb(116 82 255) 55% 78%, rgb(245 178 42) 78% 100%)',
  },
]

const isAppTheme = (value: string | null): value is AppTheme =>
  value === 'playful' ||
  value === 'canopy' ||
  value === 'prism' ||
  value === 'afterdark' ||
  value === 'acidgarden'

const readThemeFromStorage = (): AppTheme => {
  if (typeof window === 'undefined') return 'playful'
  const themeFromUrl = readThemeFromLocation()
  if (isAppTheme(themeFromUrl)) return themeFromUrl
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isAppTheme(stored) ? stored : 'playful'
  } catch {
    return 'playful'
  }
}

const readViewFromLocation = (): AppView =>
  typeof window !== 'undefined' && window.location.hash === '#about'
    ? 'about'
    : 'poster'

const initialShare = readShareFromLocation()
const initialLocks = readLocksFromLocation()
const initialLanguage = readLanguageFromLocation()
const defaultPlaceSeed = places.find((place) => place.id === 'nairobi-ke') ?? places[0]
const defaultPlace = canonicalizePlace({
  ...defaultPlaceSeed,
  // Treat first-load Nairobi like a searched city so URL/state mirrors
  // selector-driven custom-place behavior (`c.*` token path).
  id: 'default-nairobi-bootstrap',
})

function App() {
  const [selectedPlace, setSelectedPlace] = useState<Place>(
    initialShare?.place ?? defaultPlace,
  )
  const [view, setView] = useState<AppView>(readViewFromLocation)
  const [theme, setTheme] = useState<AppTheme>(readThemeFromStorage)

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore storage errors; theme still applies for current session.
    }
  }, [theme])

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
    <div className={`app-shell ${THEME_CLASS_BY_ID[theme]} text-ink`}>
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
        <section className={`app-view${view === 'poster' ? '' : ' app-view--hidden'}`} aria-hidden={view !== 'poster'}>
          <BentoPoster
            selectedPlace={selectedPlace}
            onPlaceChange={handlePlaceChange}
            theme={theme}
            themeOptions={THEME_OPTIONS}
            onThemeChange={setTheme}
            initialSeed={initialShare?.seed}
            initialLocks={initialLocks}
            initialLanguage={initialLanguage ?? undefined}
            onShowAbout={() => showView('about')}
          />
        </section>
        <section className={`app-view${view === 'about' ? '' : ' app-view--hidden'}`} aria-hidden={view !== 'about'}>
          <AboutPage onBack={() => showView('poster')} />
        </section>
      </main>
    </div>
  )
}

export default App
