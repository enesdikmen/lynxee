/**
 * Simple city search backed by Nominatim (OpenStreetMap).
 *
 * Debounced free-text input → dropdown of matches → emits a `Place`.
 * Stays in the `Place` shape the rest of the app already consumes.
 */
import { useEffect, useRef, useState } from 'react'
import { searchCities } from '../api/nominatim'
import type { Place } from '../types/lens'
import './CitySearch.css'

interface Props {
  selected?: Place
  onSelect: (place: Place) => void
  placeholder?: string
}

export default function CitySearch({ selected, onSelect, placeholder = 'Search a city…' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Debounced search.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      setError(false)
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(false)
      try {
        const places = await searchCities(q, { signal: ctrl.signal })
        setResults(places)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError(true)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  // Close dropdown on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(p: Place) {
    onSelect(p)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const buttonLabel = selected?.label ?? 'Pick a city'

  return (
    <div className="city-search" ref={wrapRef}>
      <input
        className="city-search__input"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={selected ? buttonLabel : placeholder}
        aria-label="Search a city"
      />
      {open && query.trim().length >= 2 && (
        <div className="city-search__dropdown" role="listbox">
          {loading && <div className="city-search__hint">Searching…</div>}
          {error && <div className="city-search__hint city-search__hint--err">Search failed</div>}
          {!loading && !error && results.length === 0 && (
            <div className="city-search__hint">No matches</div>
          )}
          {!loading &&
            !error &&
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                className="city-search__item"
                onClick={() => pick(p)}
                role="option"
              >
                <span className="city-search__name">{p.label}</span>
                {p.country && <span className="city-search__country">{p.country}</span>}
              </button>
            ))}
          <div className="city-search__attr">© OpenStreetMap contributors</div>
        </div>
      )}
    </div>
  )
}
