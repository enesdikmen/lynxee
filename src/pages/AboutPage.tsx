interface Props {
  onBack: () => void
}

const speciesGroups = ['Mammal', 'Bird', 'Insect', 'Flowering plant', 'Tree or fern', 'Fungus']
const imageSteps = ['iNaturalist exact match', 'Wikidata / Commons GBIF key', 'GBIF species media']
const dataSignals = ['Month', 'Year', 'Kingdom', 'Dataset', 'Evidence type']

function AboutPage({ onBack }: Props) {
  const docsBaseUrl = 'https://github.com/enesdikmen/bee-around/blob/main'

  return (
    <section className="about-page" aria-labelledby="about-page-title">
      <div className="about-content">
        <button type="button" className="about-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <section className="about-top-row">
          <section className="about-card about-hero-card">
            <p className="about-kicker">About</p>
            <h1 id="about-page-title">Bee Around</h1>
            <p>
              Bee Around turns open GBIF biodiversity records into playful,
              shareable portraits of places. Pick a place, refresh for a new
              lens, lock favorite cards, and export a poster for outreach,
              education, or quick discovery.
            </p>
            <div className="about-github-links" aria-label="Detailed documentation links">
              <a href={`${docsBaseUrl}/README.md`} target="_blank" rel="noopener noreferrer">
                <GitHubIcon />
                README
              </a>
              <a href={`${docsBaseUrl}/docs/how-it-works.md`} target="_blank" rel="noopener noreferrer">
                <GitHubIcon />
                How it works
              </a>
              <a href={`${docsBaseUrl}/docs/data-and-attribution.md`} target="_blank" rel="noopener noreferrer">
                <GitHubIcon />
                Data notes
              </a>
            </div>
            <div className="about-hero-strip" aria-label="Poster ingredients">
              <span>Sightings on GBIF</span>
              <span>Biodiversity Portrait</span>
              <span>Data from GBIF</span>
            </div>
          </section>

          <article className="about-card about-developer-card" aria-label="Developer card">
            <div className="about-developer-card__image" role="img" aria-label="Developer photo placeholder" />
            <span className="about-developer-card__ribbon">Developer</span>
            <span className="about-developer-card__name">Enes Dikmen</span>
            <span className="about-developer-card__sci">Homo sapiens</span>
          </article>
        </section>

        <section className="about-grid about-grid--story">
          <article className="about-card about-topic about-topic--wide">
            <div className="about-topic__head">
              <span className="about-topic__mark">01</span>
              <h2>What area is the poster about?</h2>
            </div>
            <div className="about-split about-split--area">
              <div className="about-copy">
                <p>
                  Place search comes from OpenStreetMap Nominatim. Bee Around
                  keeps the selected label, center point, country code, and
                  bounding box.
                </p>
                <p>
                  GBIF queries prefer that bounding box. If none exists, the
                  app makes a rectangle from the fallback radius. Very large
                  boxes use <code>country=XX</code> when possible.
                </p>
              </div>
              <div className="about-logic-panel">
                <div className="about-flow" aria-label="Area selection flow">
                  <span>Place search</span>
                  <span>Bounding box</span>
                  <span>GBIF records</span>
                </div>
                <div className="about-map-card" aria-label="Bounding box area sketch">
                  <span className="about-map-card__grid" />
                  <span className="about-map-card__bbox" />
                  <span className="about-map-card__pin" />
                  <span className="about-map-card__label">selected area</span>
                </div>
              </div>
            </div>
          </article>

          <article className="about-card about-topic about-topic--wide">
            <div className="about-topic__head">
              <span className="about-topic__mark">02</span>
              <h2>Which GBIF data is summarized?</h2>
            </div>
            <div className="about-split about-split--data">
              <div className="about-copy">
                <p>
                  The poster asks GBIF for compact occurrence facets with
                  <code>limit=0</code>. That gives counts and grouped summaries
                  without downloading every record.
                </p>
                <p>
                  The main query groups by month, year, dataset, kingdom, and
                  evidence type. Smaller queries build species, conservation,
                  and thematic candidate pools.
                </p>
              </div>
              <div className="about-logic-panel about-logic-panel--dark">
                <div className="about-query-card" aria-label="GBIF summary query sketch">
                  <span>occurrence/search</span>
                  <b>limit=0</b>
                  <small>count + facets</small>
                </div>
                <span className="about-arrow-label">facets become cards</span>
                <div className="about-chip-cloud about-chip-cloud--connected">
                  {dataSignals.map((signal) => (
                    <span key={signal}>{signal}</span>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="about-card about-topic about-topic--wide">
            <div className="about-topic__head">
              <span className="about-topic__mark">03</span>
              <h2>How are species selected?</h2>
            </div>
            <div className="about-split about-split--species">
              <div className="about-copy">
                <p>
                  Featured species come from broad taxonomic slots. Each slot
                  asks GBIF for the most recorded local species in that class or
                  kingdom.
                </p>
                <p>
                  Bee Around keeps a small top pool, removes weakly represented
                  candidates, then uses the poster seed to choose a repeatable
                  mix.
                </p>
              </div>
              <div className="about-logic-panel">
                <div className="about-chip-cloud about-chip-cloud--groups">
                  {speciesGroups.map((group) => (
                    <span key={group}>{group}</span>
                  ))}
                </div>
                <span className="about-arrow-label">top local candidates</span>
                <div className="about-species-board" aria-label="Species slot selection sketch">
                  {['Bird', 'Insect', 'Plant'].map((label, index) => (
                    <div key={label}>
                      <span>{label}</span>
                      <i className={index === 1 ? 'is-picked' : undefined} />
                      <i />
                      <i />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="about-card about-topic about-topic--labels">
            <div className="about-topic__head">
              <span className="about-topic__mark">04</span>
              <h2>What do the poster labels mean?</h2>
            </div>
            <div className="about-label-list">
              <div>
                <span className="about-poster-label about-poster-label--season">In season - June</span>
                <p>Seeded from top species recorded in the current calendar month.</p>
              </div>
              <div>
                <span className="about-poster-label about-poster-label--small">Small wonder</span>
                <p>Seeded from top local insect and fungus candidates.</p>
              </div>
              <div>
                <span className="about-poster-label about-poster-label--night">Night creature</span>
                <p>Seeded from top local bats, owls, moths, fireflies, and related groups.</p>
              </div>
              <div>
                <span className="about-poster-label about-poster-label--risk">At risk - CR</span>
                <p>Chosen from top local species in the highest available IUCN risk bucket.</p>
              </div>
              <div>
                <span className="about-poster-label about-poster-label--signature">Signature - 12x</span>
                <p>Chosen from species whose local GBIF share is high versus the global baseline.</p>
              </div>
            </div>
          </article>

          <article className="about-card about-topic">
            <div className="about-topic__head">
              <span className="about-topic__mark">05</span>
              <h2>How are photos chosen?</h2>
            </div>
            <div className="about-copy">
              <p>
                Species identity is chosen from GBIF data first. Images are a
                best-effort fallback layer added afterward.
              </p>
              <p>
                Sources are tried in priority order. If no image resolves, the
                species stays and the card uses a placeholder.
              </p>
            </div>
            <div className="about-connected-block">
              <div className="about-fallback-list" aria-label="Photo fallback priority">
                {imageSteps.map((step) => (
                  <span key={step}>{step}</span>
                ))}
                <b>first match wins</b>
              </div>
            </div>
          </article>

          <article className="about-card about-topic">
            <div className="about-topic__head">
              <span className="about-topic__mark">06</span>
              <h2>How does the comparison work?</h2>
            </div>
            <div className="about-copy">
              <p>
                A notebook resolves curated cities and countries, then queries
                GBIF facets for each bounding box.
              </p>
              <p>
                It computes area, record density, threatened share, and
                unique-species counts, then ranks rows inside city or country
                cohorts. The app ships the slim percentile file.
              </p>
            </div>
            <div className="about-connected-block">
              <div className="about-precompute-flow" aria-label="Precompute workflow">
                <span>places</span>
                <span>facets</span>
                <span>percentiles</span>
              </div>
              <div className="about-meter-set" aria-label="Example comparison bars">
                <div>
                  <span>Recording intensity</span>
                  <b style={{ width: '78%' }} />
                </div>
                <div>
                  <span>Threatened share</span>
                  <b style={{ width: '46%' }} />
                </div>
              </div>
            </div>
          </article>

          <article className="about-card about-topic">
            <div className="about-topic__head">
              <span className="about-topic__mark">07</span>
              <h2>Why does Regenerate stay repeatable?</h2>
            </div>
            <div className="about-copy">
              <p>
                Every poster has a seed. Regenerate changes the seed, rotating
                eligible top candidates and unlocked card positions.
              </p>
              <p>
                Species are deduplicated across cards, and shared links store
                the place, seed, theme, language, and locks.
              </p>
            </div>
            <div className="about-connected-block">
              <div className="about-seed-row">
                <span>Seed 1</span>
                <span>Seed 2</span>
                <span>Share URL</span>
              </div>
            </div>
          </article>

          <article className="about-card about-topic">
            <div className="about-topic__head">
              <span className="about-topic__mark">08</span>
              <h2>Where do credits come from?</h2>
            </div>
            <p>
              Species names, taxonomy, occurrence counts, dataset metadata, and
              GBIF species links come from GBIF. Photo credits and licenses are
              shown when the image source provides them.
            </p>
            <div className="about-doc-links">
              <a href={`${docsBaseUrl}/docs/how-it-works.md`}>
                How it works
              </a>
              <a href={`${docsBaseUrl}/docs/data-and-attribution.md`}>
                Data and attribution
              </a>
            </div>
          </article>
        </section>
      </div>
    </section>
  )
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      className="about-github-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.93.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 7c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.84 0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  )
}

export default AboutPage
