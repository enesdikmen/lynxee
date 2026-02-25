import type { ChangeEvent } from 'react'

type PlaceOption = {
  id: string
  label: string
}

type PlaceDetails = {
  label: string
  latitude: number
  longitude: number
  radiusKm: number
}

type HeaderStat = {
  label: string
  value: string
}

type LensHeaderProps = {
  title: string
  description: string
  places: PlaceOption[]
  selectedPlaceId: string
  onChangePlace: (event: ChangeEvent<HTMLSelectElement>) => void
  placeDetails?: PlaceDetails
  stats: HeaderStat[]
}

function LensHeader({
  title,
  description,
  places,
  selectedPlaceId,
  onChangePlace,
  placeDetails,
  stats,
}: LensHeaderProps) {
  return (
    <header className="rounded-xl border-4 border-border bg-accent-soft p-8 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-ink">
            Lynxee lens
          </p>
          <h1 className="text-3xl font-semibold text-ink md:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-ink">{description}</p>
        </div>
        <div className="rounded-lg border-4 border-border bg-lens px-4 py-3 text-xs font-semibold text-ink shadow-soft">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] uppercase tracking-[0.2em] text-ink">
              Place
            </label>
            <select
              className="rounded-md border-2 border-border bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-soft"
              value={selectedPlaceId}
              onChange={onChangePlace}
            >
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.label}
                </option>
              ))}
            </select>
            {placeDetails && (
              <p className="text-[11px] text-ink">
                Lat {placeDetails.latitude.toFixed(3)}, Lon{' '}
                {placeDetails.longitude.toFixed(3)}, Radius {placeDetails.radiusKm}{' '}
                km
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border-4 border-border bg-paper p-4 text-ink shadow-soft"
          >
            <p className="text-[11px] uppercase tracking-[0.2em]">
              {item.label}
            </p>
            <p className="mt-2 text-xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </header>
  )
}

export default LensHeader
