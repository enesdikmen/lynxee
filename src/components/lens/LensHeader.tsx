import type { Place } from '../../types/lens'

type HeaderStat = {
  label: string
  value: string
}

type LensHeaderProps = {
  selectedPlace?: Place
  selectedPlaceId: string
  places: Place[]
  stats: HeaderStat[]
  onPlaceChange: (placeId: string) => void
}

const LensHeader = ({
  selectedPlace,
  selectedPlaceId,
  places,
  stats,
  onPlaceChange,
}: LensHeaderProps) => (
  <header className="paper-card bg-accent-soft p-8">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-3">
        <p className="sticker-badge sticker-badge--sunny">
          Lynxee lens
        </p>
        <h1 className="text-3xl font-semibold text-ink md:text-4xl">
          {selectedPlace?.label ?? 'Pick a place'} biodiversity portrait
        </h1>
        <p className="text-sm text-ink">
          Static layout preview for the first data lens. Placeholder values show
          what each panel will contain.
        </p>
      </div>
      <div className="paper-card paper-card--mini bg-lens px-4 py-3 text-xs font-semibold text-ink">
        <div className="flex flex-col gap-2">
          <label className="sticker-badge sticker-badge--lens">
            Place
          </label>
          <select
            className="rounded-md border-2 border-border bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-soft"
            value={selectedPlaceId}
            onChange={(event) => onPlaceChange(event.target.value)}
          >
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-ink">
            Lat {selectedPlace?.latitude.toFixed(3)}, Lon{' '}
            {selectedPlace?.longitude.toFixed(3)}, Radius{' '}
            {selectedPlace?.radiusKm} km
          </p>
        </div>
      </div>
    </div>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      {stats.map((item) => (
        <div
          key={item.label}
          className="paper-card paper-card--mini paper-card--wiggle bg-paper p-4 text-ink"
        >
          <p className="sticker-badge">
            {item.label}
          </p>
          <p className="mt-2 text-xl font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  </header>
)

export default LensHeader
