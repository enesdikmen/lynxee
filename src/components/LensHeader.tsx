import type { ChangeEvent } from 'react'
import { motion } from 'framer-motion'

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
  onlyWithImages: boolean
  onToggleOnlyWithImages: (event: ChangeEvent<HTMLInputElement>) => void
  placeDetails?: PlaceDetails
  stats: HeaderStat[]
  stickerBase: string
}

function LensHeader({
  title,
  description,
  places,
  selectedPlaceId,
  onChangePlace,
  onlyWithImages,
  onToggleOnlyWithImages,
  placeDetails,
  stats,
  stickerBase,
}: LensHeaderProps) {
  const statHints: Record<string, string> = {
    'Records used': 'GBIF occurrence count',
    'Top species in view': 'Top species facets',
    'Last refresh': 'Local time',
  }

  return (
    <motion.header
      className="paper-card bg-accent-soft p-6 hover-group"
      whileHover={{ y: -6, scale: 1.01 }}
      whileFocus={{ y: -6, scale: 1.01 }}
      transition={{ duration: 0.24 }}
    >
      <span className="collage-sticker collage-sticker--leaf collage-sticker--header">
        <img src={`${stickerBase}leaf.svg`} alt="Leaf sticker" />
      </span>
      <span className="collage-sticker collage-sticker--leaf-2 collage-sticker--header">
        <img src={`${stickerBase}leaf.svg`} alt="Leaf sticker" />
      </span>
      <span className="collage-sticker collage-sticker--sun collage-sticker--header">
        <img src={`${stickerBase}sun.svg`} alt="Sunny sticker" />
      </span>
      <span className="collage-sticker collage-sticker--sun-2 collage-sticker--header">
        <img src={`${stickerBase}sun.svg`} alt="Sunny sticker" />
      </span>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="sticker-badge sticker-badge--sunny">
            Lynxee lens
          </p>
          <h1 className="poster-headline text-4xl text-ink md:text-[2.9rem]">
            {title}
          </h1>
          <p className="text-sm text-ink">{description}</p>
        </div>
  <div className="paper-card paper-card--mini bg-lens px-4 py-2 text-xs font-semibold text-ink">
          <div className="flex flex-col gap-2">
            <label className="sticker-badge sticker-badge--lens">
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
            <label className="flex items-center gap-2 text-[11px] text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-2 border-border accent-[rgb(var(--color-forest))]"
                checked={onlyWithImages}
                onChange={onToggleOnlyWithImages}
              />
              Only species with photos
            </label>
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
  <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {stats.map((item) => (
          <motion.div
            key={item.label}
            className="collage-stat paper-card paper-card--mini paper-card--wiggle hover-group hover-glow bg-paper p-3 text-ink"
            whileHover={{ y: -4, scale: 1.02 }}
            whileFocus={{ y: -4, scale: 1.02 }}
            transition={{ duration: 0.22 }}
          >
            <span className="hover-stamp hover-stamp--top-right">
              {statHints[item.label] ?? 'GBIF signal'}
            </span>
            <p className="sticker-badge">
              {item.label}
            </p>
            <p className="poster-title mt-2 text-2xl text-ink">{item.value}</p>
          </motion.div>
        ))}
      </div>
    </motion.header>
  )
}

export default LensHeader
