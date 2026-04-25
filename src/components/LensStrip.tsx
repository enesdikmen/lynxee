/**
 * Compact themed "lens" strip — kicker + intro and a row of 3 equally-sized
 * species blobs. Used for thematic mini-sections (e.g. "In season",
 * "Small wonders") that should be visually lighter than the main
 * SpeciesGallery and live two-up in a single row.
 */
import { motion } from 'framer-motion'

type SpeciesCard = {
  id: string
  commonName: string
  scientificName: string
  imageUrl: string
  highlight: string
  taxonLine?: string
  popularity?: number
}

type LensStripProps = {
  species: SpeciesCard[]
  kicker: string
  intro?: string
}

function LensStrip({ species, kicker, intro }: LensStripProps) {
  if (!species.length) return null

  return (
    <section className="lens-strip">
      <header className="lens-strip__header">
        <span className="lens-strip__kicker">{kicker}</span>
        {intro && <p className="lens-strip__intro">{intro}</p>}
      </header>

      <div className="lens-strip__row">
        {species.slice(0, 3).map((sp) => (
          <motion.div
            key={sp.id}
            className="lens-strip__item"
            whileHover={{ y: -4, scale: 1.05, rotate: 0 }}
            transition={{ duration: 0.22 }}
          >
            <img
              src={sp.imageUrl}
              alt={sp.commonName}
              className="lens-strip__img"
              loading="lazy"
            />
            <span className="lens-strip__name">{sp.commonName}</span>
            <span className="lens-strip__sci">{sp.scientificName}</span>
            {sp.popularity ? (
              <span className="lens-strip__count">
                {sp.popularity.toLocaleString()}
              </span>
            ) : null}
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export default LensStrip
