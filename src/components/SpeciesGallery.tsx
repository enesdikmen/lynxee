/**
 * Species gallery — hero image blob + scattered circular thumbnails.
 * No cards. Images live directly on the poster surface.
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

type SpeciesGalleryProps = {
  topSpecies: SpeciesCard[]
  multilingualNames?: { language: string; name: string }[]
}

function SpeciesGallery({
  topSpecies,
  multilingualNames = [],
}: SpeciesGalleryProps) {
  const hero = topSpecies[0]
  const rest = topSpecies.slice(1)

  return (
    <section className="species-gallery">
      {/* Hero — large blob image with text beside it */}
      {hero && (
        <div className="species-hero-row">
          <motion.img
            src={hero.imageUrl}
            alt={hero.commonName}
            className="species-hero-img"
            loading="lazy"
            whileHover={{ rotate: 0, scale: 1.04 }}
            transition={{ duration: 0.3 }}
          />
          <div className="species-hero-text">
            <h2 className="species-hero-text__name">{hero.commonName}</h2>
            <p className="species-hero-text__sci">{hero.scientificName}</p>
            {multilingualNames.length > 0 && (
              <p className="species-hero-text__langs">
                {multilingualNames.map((n, i) => (
                  <span key={n.language} className="species-hero-text__lang">
                    <span className="species-hero-text__lang-code">{n.language}</span>
                    {n.name}
                    {i < multilingualNames.length - 1 && (
                      <span className="species-hero-text__lang-sep"> · </span>
                    )}
                  </span>
                ))}
              </p>
            )}
            <p className="species-hero-text__detail">
              {hero.popularity
                ? `${hero.popularity.toLocaleString()} observations · `
                : ''}
              {hero.highlight}
            </p>
            {hero.taxonLine && (
              <span className="species-hero-text__badge">{hero.taxonLine}</span>
            )}
          </div>
        </div>
      )}

      {/* Secondary species — scattered circles */}
      <div className="species-circles">
        {rest.map((sp) => (
          <motion.div
            key={sp.id}
            className="species-circle"
            whileHover={{ y: -5, scale: 1.08, rotate: 0 }}
            transition={{ duration: 0.22 }}
          >
            <img
              src={sp.imageUrl}
              alt={sp.commonName}
              className="species-circle__img"
              loading="lazy"
            />
            <span className="species-circle__name">{sp.commonName}</span>
            <span className="species-circle__sci">{sp.scientificName}</span>
            {sp.popularity && (
              <span className="species-circle__count">
                {sp.popularity.toLocaleString()}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export default SpeciesGallery
