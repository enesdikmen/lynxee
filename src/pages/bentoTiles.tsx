/**
 * Bento card registry + tile builder.
 *
 * Single source of truth for what cards exist on the poster, how big they
 * are, how they should be placed, and how they render their content.
 *
 * Each card is one entry in {@link CARD_DEFS}. A card may emit zero, one,
 * or many tile instances per poster (e.g. `speciesMini` emits one tile per
 * species in the gallery). Eligibility lives inside the card's `build()`:
 * return `[]` to skip the card for the current data.
 *
 * Adding a new card type: append a new entry to {@link CARD_DEFS} — nothing
 * else changes. Removing one: delete its entry.
 *
 * Future hooks (not implemented yet — the shape is ready for them):
 *   - Priority / max-instance caps per card type for tight layouts.
 */
import type { ReactNode } from 'react'
import type { useLensData } from '../hooks/useLensData'
import type { Anchor } from '../lib/gridPacker'
import Globe from '../components/Globe'
import type { UiLanguage, UiText } from '../i18n/uiText'
import { seededShuffle } from '../hooks/lensData/shared'
import { SPECIES_MINI_COUNT } from '../data/lensSelection'
import { IMAGE_SOURCE_LABELS } from '../api/speciesImage'
import type {
  ImageCredit,
  SpeciesCard,
  ThematicStripCard,
  ThreatenedSpecies,
} from '../types/lens'
import type { SignatureSpeciesCard } from '../hooks/lensData/signatureSpecies'
import { QRCodeSVG } from 'qrcode.react'
// NOTE: ~36 MB JSON; bundled into the main chunk for now. When this card
// graduates from the prototype, switch to a slimmed runtime payload or a
// dynamic import. The shape matches `precompute_comparison_sample.ipynb`.
import comparisonRaw from '../comparison_precompute.json'

/** Corner the tile should be hard-pinned to. Resolved against the current
 *  grid size in {@link BentoPoster} so `bottom-right` follows the height. */
export type PinCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** Allowed tile sizes on the bento grid. The packer assumes 1..2 cells per axis. */
export type TileSize = { w: 1 | 2; h: 1 | 2 }

/** A single rendered card on the poster. */
export type Tile = {
  id: string
  w: 1 | 2
  h: 1 | 2
  /** Soft preference — packer tries this corner first but may place elsewhere. */
  anchor?: Anchor
  /** Hard pin — packer is forced to put the tile in this corner. */
  pin?: PinCorner
  /** Exact-cell pin (overrides `pin`). Used by the lock-card feature to
   *  freeze a tile to its previous placement across Regenerate. */
  pinXY?: { x: number; y: number }
  className: string
  render: () => ReactNode
  /** Stable slot identifier used by the per-card lock feature. Tiles
   *  without a slotId are not lockable (e.g. fillers). */
  slotId?: string
  /** Species ids (as in `SpeciesCardBase.id`) that this tile is showing.
   *  Used to prevent the same species appearing twice across the
   *  locked / freshly-generated boundary. */
  speciesIds?: string[]
}

type LensData = ReturnType<typeof useLensData>

/** Fixed poster dimensions. Size selection is intentionally removed. */
export const POSTER_GRID_W = 6
export const POSTER_GRID_H = 4
export const POSTER_GRID_AREA = POSTER_GRID_W * POSTER_GRID_H

/** What `buildBentoTiles` hands to each card. Lean on purpose. */
export type CardBuildCtx = {
  placeName: string
  latitude?: number
  longitude?: number
  language: UiLanguage
  uiText: UiText
  /** Poster/content seed bumped by Regenerate; cards can key random picks to it. */
  contentSeed: number
  data: LensData
  /** Current shareable URL — encodes place + seed. Used by the sources QR. */
  shareUrl?: string
}

/** What a card's `build()` returns. Per-instance overrides are optional and
 *  only needed when one card type wants to vary size/placement/style per
 *  instance (e.g. alternating accents). */
export type TileInstance = {
  id: string
  render: () => ReactNode
  size?: TileSize
  anchor?: Anchor
  pin?: PinCorner
  className?: string  /** Stable identifier of the slot this instance fills. Survives content
   *  rotation (e.g. `mini-0` stays the same even when the species in slot
   *  0 changes). Required for tiles that should be lockable. */
  slotId?: string
  /** Species ids (matching `SpeciesCardBase.id`) shown by this tile. */
  speciesIds?: string[]}

/** Definition of a card type. */
export type CardDef = {
  /** Stable identifier for the card type. */
  type: string
  /** Default size for instances of this card. */
  size: TileSize
  /** Default placement hint. */
  anchor?: Anchor
  pin?: PinCorner
  /** Default className. */
  className: string
  /** Produce tile instances for the current context. Return `[]` to skip. */
  build: (ctx: CardBuildCtx) => TileInstance[]
}

const THEMATIC_PRIMARY_COUNT = 2
const THEMATIC_CARD_CLASS =
  'bento-card bento-card--mini bento-card--thematic accent-gold'

const SPECIES_PATTERN_CLASS_BY_KIND = {
  species: 'bento-pattern--species',
  mammal: 'bento-pattern--mammal',
  bird: 'bento-pattern--bird',
  insect: 'bento-pattern--insect',
  plant: 'bento-pattern--plant',
  fungi: 'bento-pattern--fungi',
  fish: 'bento-pattern--fish',
} as const

const speciesPatternClass = (sp: Pick<SpeciesCard, 'highlight' | 'taxonLine'>) => {
  const text = `${sp.highlight ?? ''} ${sp.taxonLine ?? ''}`.toLowerCase()
  const kind =
    text.includes('fung') ? 'fungi' :
    text.includes('bird') || text.includes('aves') ? 'bird' :
    text.includes('insect') || text.includes('arachnid') || text.includes('arthropod') ? 'insect' :
    text.includes('fish') || text.includes('actinopterygii') || text.includes('amphibian') ? 'fish' :
    text.includes('plant') || text.includes('flower') || text.includes('tree') || text.includes('fern') || text.includes('plantae') ? 'plant' :
    text.includes('mammal') || text.includes('mammalia') ? 'mammal' :
    undefined

  return kind
    ? `bento-card--species-pattern ${SPECIES_PATTERN_CLASS_BY_KIND[kind]}`
    : `bento-card--species-pattern ${SPECIES_PATTERN_CLASS_BY_KIND.species}`
}

function toThematicTileInstance(
  card: {
    id: ThematicStripCard['id']
    kicker: string
    species: CardBuildCtx['data']['thematicStripCards'][number]['species']
  },
  index: number,
  language: UiLanguage,
  uiText: UiText,
): TileInstance | null {
  const sp = card.species[0]
  if (!sp) return null
  const monthLabel = new Intl.DateTimeFormat(language, { month: 'long' }).format(new Date(2000, new Date().getMonth(), 1))
  const thematicLabel = (() => {
    switch (card.id) {
      case 'inSeason':
        return uiText.poster.thematic.inSeason(monthLabel)
      case 'smallWonders':
        return uiText.poster.thematic.smallWonder
      case 'nightCreatures':
        return uiText.poster.thematic.nightCreature
      default:
        return card.kicker
    }
  })()
  return {
    id: `thematic-${card.id}`,
    slotId: `thematic-${card.id}`,
    speciesIds: [sp.id],
    className:
      'bento-card bento-card--mini bento-card--thematic ' +
      `${index % 2 === 0 ? 'accent-gold' : 'accent-forest'} ${speciesPatternClass(sp)}`,
    render: () => (
      <>
        {renderSpeciesImage({
          src: sp.squareImageUrl ?? sp.imageUrl,
          alt: sp.commonName,
          className: 'bento-mini__img',
          uiText,
        })}
        {renderSpeciesInfoButton(sp, { contextLine: thematicInfoLine(card.id) })}
        <span className="bento-mini__name">{sp.commonName}</span>
        <span className="bento-mini__sci">{sp.scientificName}</span>
        {sp.popularity ? (
          <span className="bento-mini__count">{sp.popularity.toLocaleString(language)}</span>
        ) : null}
        <span className="bento-mini__ribbon">{thematicLabel}</span>
      </>
    ),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Render helpers shared by multiple cards.
// ───────────────────────────────────────────────────────────────────────────

const MONTH = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

const fmtPct = (share: number) => {
  if (share >= 0.1) return `${Math.round(share * 100)}%`
  if (share >= 0.01) return `${(share * 100).toFixed(1)}%`
  return '<1%'
}

const sourceLabel = (source?: keyof typeof IMAGE_SOURCE_LABELS) =>
  source ? IMAGE_SOURCE_LABELS[source] : null

const creditLabel = (
  credit?: ImageCredit,
  source?: keyof typeof IMAGE_SOURCE_LABELS,
) => credit?.label ?? sourceLabel(source)

const imageCreditTitle = (
  credit?: ImageCredit,
  source?: keyof typeof IMAGE_SOURCE_LABELS,
) => {
  const label = creditLabel(credit, source)
  if (!label) return null
  const parts = [
    credit?.author ? `Photo: ${credit.author}` : 'Photo source',
    credit?.license,
    label,
  ].filter(Boolean)
  return parts.join(' · ')
}

type SpeciesInfoCard = SpeciesCard | ThreatenedSpecies | SignatureSpeciesCard

const formatRatio = (ratio: number) =>
  ratio >= 10 ? `${Math.round(ratio)}×` : `${ratio.toFixed(1)}×`

const thematicInfoLine = (id: ThematicStripCard['id']) => {
  switch (id) {
    case 'inSeason':
      return 'Picked for this month'
    case 'smallWonders':
      return 'Picked from tiny taxa'
    case 'nightCreatures':
      return 'Picked from nocturnal taxa'
  }
}

const renderSpeciesInfoButton = (
  sp: SpeciesInfoCard,
  {
    className = '',
    contextLine,
  }: {
    className?: string
    contextLine?: string
  } = {},
) => {
  const photoLabel = creditLabel(sp.imageCredit, sp.imageSource)
  const photoTitle = imageCreditTitle(sp.imageCredit, sp.imageSource)
  const iucnLabel =
    'iucnLabel' in sp && sp.iucnLabel
      ? `${sp.iucnLabel}${sp.iucnCategory ? ` (${sp.iucnCategory})` : ''}`
      : null
  const signatureRatio =
    'overRepresentationRatio' in sp &&
    typeof sp.overRepresentationRatio === 'number'
      ? formatRatio(sp.overRepresentationRatio)
      : null
  const classes = ['bento-species-info', className].filter(Boolean).join(' ')

  return (
    <span
      className={classes}
      tabIndex={0}
      aria-label={`${sp.commonName} details`}
    >
      <span className="bento-species-info__panel" role="tooltip">
        <span className="bento-species-info__name">{sp.commonName}</span>
        <span className="bento-species-info__sci">{sp.scientificName}</span>
        {sp.taxonLine && (
          <span className="bento-species-info__line">{sp.taxonLine}</span>
        )}
        {iucnLabel ? (
          <span className="bento-species-info__line">IUCN: {iucnLabel}</span>
        ) : signatureRatio ? (
          <span className="bento-species-info__line">
            Signature species: {signatureRatio} more represented here
          </span>
        ) : contextLine ? (
          <span className="bento-species-info__line">{contextLine}</span>
        ) : null}
        <a
          className="bento-species-info__taxon-link"
          href={`https://www.gbif.org/species/${sp.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.currentTarget.blur()}
        >
          View taxon on GBIF
          <span className="bento-species-info__external" aria-hidden="true">↗︎</span>
        </a>
        {photoLabel && (
          <span className="bento-species-info__photo">
            {photoTitle && sp.imageCredit?.sourceUrl ? (
              <a
                href={sp.imageCredit.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.currentTarget.blur()}
              >
                {photoTitle}
                <span className="bento-species-info__external" aria-hidden="true">↗︎</span>
              </a>
            ) : photoTitle ? (
              <span>{photoTitle}</span>
            ) : sp.imageCredit?.sourceUrl ? (
              <a
                href={sp.imageCredit.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.currentTarget.blur()}
              >
                Photo source: {photoLabel}
                <span className="bento-species-info__external" aria-hidden="true">↗︎</span>
              </a>
            ) : (
              <span>Photo source: {photoLabel}</span>
            )}
          </span>
        )}
      </span>
    </span>
  )
}

type SpeciesImageProps = {
  src?: string
  alt: string
  className: string
  uiText: UiText
  loading?: 'lazy' | 'eager'
}

const renderSpeciesImage = ({
  src,
  alt,
  className,
  loading = 'lazy',
  uiText,
}: SpeciesImageProps) => {
  if (src) {
    return <img src={src} alt={alt} className={className} loading={loading} />
  }
  return (
    <div
      className={`${className} bento-img-placeholder`}
      role="img"
      aria-label={uiText.poster.imageUnavailableAria(alt)}
    />
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Comparison precompute — lookup helpers for the "how this place compares"
// card. The notebook produces one row per curated city/country; here we
// resolve the *currently selected* place to its closest matching row.
// ───────────────────────────────────────────────────────────────────────────

type ComparisonPercentiles = {
  cohort: 'city' | 'country'
  cohortSize: number
  recordsPerKm2?: number | null
  uniqueSpecies?: number | null
  threatenedShare?: number | null
}

type ComparisonSignature = {
  speciesKey: number
  localCount: number
  globalCount: number
  localShare: number
  globalShare: number
  overRepresentationRatio: number
}

type ComparisonRow = {
  id: string
  kind: 'city' | 'country'
  place: {
    label: string
    latitude?: number | null
    longitude?: number | null
    bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null
  }
  percentiles?: ComparisonPercentiles | null
  signatureSpecies?: ComparisonSignature[] | null
}

const COMPARISON_ROWS = (comparisonRaw as { rows: ComparisonRow[] }).rows ?? []

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Resolve the currently selected place to a precomputed comparison row.
 *  Strategy: nearest city within 75 km (cohort=city), else country whose
 *  bbox contains the point (cohort=country). Returns `null` if neither
 *  matches — the card will then opt out. */
function findComparisonRow(
  latitude: number | undefined,
  longitude: number | undefined,
): ComparisonRow | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  let bestCity: ComparisonRow | null = null
  let bestCityDist = 75 // km cutoff
  for (const row of COMPARISON_ROWS) {
    if (row.kind !== 'city') continue
    const p = row.place
    if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') continue
    const d = haversineKm(latitude, longitude, p.latitude, p.longitude)
    if (d <= bestCityDist) {
      bestCityDist = d
      bestCity = row
    }
  }
  if (bestCity) return bestCity
  for (const row of COMPARISON_ROWS) {
    if (row.kind !== 'country') continue
    const bb = row.place.bbox
    if (!bb) continue
    if (
      latitude >= bb.minLat &&
      latitude <= bb.maxLat &&
      longitude >= bb.minLon &&
      longitude <= bb.maxLon
    ) {
      return row
    }
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Card registry. Each entry is self-contained: type, size, placement, style,
// and a `build` that decides eligibility and produces tile instances.
// ───────────────────────────────────────────────────────────────────────────

export const CARD_DEFS: CardDef[] = [
  {
    type: 'title',
    size: { w: 2, h: 1 },
    className: 'bento-card bento-card--title accent-gold',
    build: ({ placeName, latitude, longitude, uiText }) => [
      {
        id: 'title',
        slotId: 'title',
        render: () => (
          <div className="bento-title__layout">
            {typeof latitude === 'number' && typeof longitude === 'number' && (
              <Globe className="bento-title__globe" lat={latitude} lon={longitude} />
            )}
            <div className="bento-title__text">
              <h1 className="bento-title">
                <span className="bento-title__place">{placeName}</span>
                <span className="bento-title__sub">{uiText.poster.portraitTitle}</span>
              </h1>
            </div>
          </div>
        ),
      },
    ],
  },

  {
    type: 'sightings',
    size: { w: 1, h: 2 },
    className: 'bento-card bento-card--sightings accent-ink',
    build: ({ data, latitude, longitude, language, uiText }) => {
      // Show the headline number plus the top 3 kingdoms as compact %
      // chips so users see the *composition* of those sightings, not just
      // the raw count. Falls back gracefully if breakdown is empty.
      const total = data.kingdomBreakdown.reduce((s, k) => s + k.count, 0)
      const topKingdoms = total > 0
        ? [...data.kingdomBreakdown]
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((k) => ({ label: k.label, share: k.count / total }))
        : []

      // IUCN buckets (merged from standalone card)
      const snap = data.conservationSnapshot
      const getIucn = (s: string) =>
        snap.categoryBreakdown.find((c) => c.status === s)?.count ?? 0
      const isIucnCapped = (s: string) =>
        snap.categoryBreakdown.find((c) => c.status === s)?.isCapped ?? false
      const makeIucnBucket = (
        label: string,
        statuses: string[],
        color: string,
      ) => ({
        label,
        count: statuses.reduce((sum, status) => sum + getIucn(status), 0),
        isCapped: statuses.some(isIucnCapped),
        color,
      })
      const iucnBuckets = snap.totalAssessedSpecies > 0
        ? [
            makeIucnBucket(uiText.poster.doingWell, ['LC'], 'rgb(var(--color-state-success))'),
            makeIucnBucket(uiText.poster.watchList, ['NT', 'DD'], 'rgb(var(--color-state-warning))'),
            makeIucnBucket(uiText.poster.atRisk, ['VU', 'EN', 'CR'], 'rgb(var(--color-state-danger))'),
          ]
        : []

      // Percentile context for the raw count: where does this place sit
      // against its peer cohort (cities or countries) from the precomputed
      // comparison sample? The 1×2 footprint gives room for two labelled
      // bars — recording intensity and threatened share — without
      // crowding the kingdom rows. This card now subsumes the old
      // standalone "How this place compares" tile.
      //
      // NOTE: `uniqueSpecies` is intentionally omitted. The metric in the
      // current `comparison_precompute.json` is saturated for ~94% of
      // places (the precompute used `len(species_counts)` with a 1000-row
      // facet cap). Once the notebook is rerun with paginated facet
      // counts, add a `{ key: 'species', label: 'Species richness', pct:
      // pcts.uniqueSpecies }` row to `ranks` below.
      const cmpRow = findComparisonRow(latitude, longitude)
      const pcts = cmpRow?.percentiles ?? null
      const cohortLabel = pcts?.cohort === 'city' ? uiText.poster.cities : uiText.poster.countries
      const cohortSize = pcts?.cohortSize
      const ranks = pcts
        ? [
            { key: 'records', label: uiText.poster.recordingIntensity, pct: pcts.recordsPerKm2 },
            { key: 'threat',  label: uiText.poster.threatenedShare,    pct: pcts.threatenedShare },
          ].filter((r): r is { key: string; label: string; pct: number } =>
            typeof r.pct === 'number' && Number.isFinite(r.pct),
          )
        : []

      return [
        {
          id: 'sightings',
          slotId: 'sightings',
          render: () => (
            <>
              <span className="bento-card__kicker">{uiText.poster.sightingsOnGbif}</span>
              <span className="bento-sightings__num">
                {data.totalRecords ? data.totalRecords.toLocaleString(language) : '—'}
              </span>
              {topKingdoms.length > 0 && (
                <ul className="bento-sightings__breakdown">
                  {topKingdoms.map((k) => (
                    <li key={k.label} className="bento-sightings__row">
                      <span className="bento-sightings__pct">{fmtPct(k.share)}</span>
                      <span className="bento-sightings__label">{k.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {iucnBuckets.length > 0 && (
                <div className="bento-sightings__iucn">
                  <span className="bento-sightings__iucn-head">{uiText.poster.iucnRedList}</span>
                  <div className="bento-sightings__iucn-pills">
                    {iucnBuckets.map((b) => (
                      <span key={b.label} className="bento-sightings__iucn-pill">
                        <span className="bento-sightings__iucn-dot" style={{ background: b.color }} />
                        <span className="bento-sightings__iucn-count">
                          {b.count.toLocaleString(language)}{b.isCapped ? '+' : ''}
                        </span>
                        <span className="bento-sightings__iucn-label">{b.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ranks.length > 0 && (
                <div className="bento-sightings__ranks">
                  <p className="bento-sightings__ranks-head">
                    {uiText.poster.comparisonTitle}
                    {typeof cohortSize === 'number' && (
                      <span className="bento-sightings__ranks-sub">
                        {' '}· {uiText.poster.comparedWith(cohortSize.toLocaleString(language), cohortLabel)}
                      </span>
                    )}
                  </p>
                  <ul className="bento-sightings__rank-list">
                    {ranks.map((r) => {
                      const pctVal = Math.max(0, Math.min(1, r.pct)) * 100
                      return (
                        <li key={r.key} className="bento-sightings__rank">
                          <div className="bento-sightings__rank-head">
                            <span className="bento-sightings__rank-label">{r.label}</span>
                            <span className="bento-sightings__rank-pct">
                              {uiText.poster.percentile(Math.max(1, Math.round(pctVal)))}
                            </span>
                          </div>
                          <div
                            className="bento-sightings__bar"
                            role="meter"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(pctVal)}
                            aria-label={uiText.poster.percentileAria(
                              r.label,
                              Math.max(1, Math.round(pctVal)),
                            )}
                          >
                            <span
                              className="bento-sightings__bar-fill"
                              style={{ width: `${pctVal}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </>
          ),
        },
      ]
    },
  },

  {
    type: 'hero',
    size: { w: 2, h: 2 },
    className: 'bento-card bento-card--hero accent-forest',
    build: ({ data, language, uiText }) => {
      const hero = data.topSpeciesData[0]
      if (!hero) return []
      return [
        {
          id: 'hero',
          slotId: 'hero',
          speciesIds: [hero.id],
          className: `bento-card bento-card--hero accent-forest ${speciesPatternClass(hero)}`,
          render: () => (
            <>
              {renderSpeciesInfoButton(hero, { className: 'bento-species-info--hero' })}
              {renderSpeciesImage({
                src: hero.imageUrl,
                alt: hero.commonName,
                className: 'bento-hero__img',
                uiText,
              })}
              <div className="bento-hero__body">
                <h2 className="bento-hero__name">{hero.commonName}</h2>
                <p className="bento-hero__sci">{hero.scientificName}</p>
                {hero.taxonLine && <span className="bento-hero__taxon">{hero.taxonLine}</span>}
                {hero.popularity ? (
                  <span className="bento-hero__count">
                    {uiText.poster.observations(hero.popularity.toLocaleString(language))}
                  </span>
                ) : null}
              </div>
            </>
          ),
        },
      ]
    },
  },

  {
    type: 'speciesMini',
    size: { w: 1, h: 1 },
    className: 'bento-card bento-card--mini accent-paper',
    build: ({ data, language, uiText }) => {
      return data.topSpeciesData.slice(1, 1 + SPECIES_MINI_COUNT).map((sp, idx) => ({
        id: `sp-${sp.id}`,
        slotId: `mini-${idx}`,
        speciesIds: [sp.id],
        className: `bento-card bento-card--mini accent-paper ${speciesPatternClass(sp)}`,
        render: () => (
          <>
            {renderSpeciesImage({
              src: sp.imageUrl,
              alt: sp.commonName,
              className: 'bento-mini__img',
              uiText,
            })}
            {renderSpeciesInfoButton(sp)}
            <span className="bento-mini__name">{sp.commonName}</span>
            <span className="bento-mini__sci">{sp.scientificName}</span>
            {sp.popularity ? (
              <span className="bento-mini__count">{sp.popularity.toLocaleString(language)}</span>
            ) : null}
          </>
        ),
      }))
    },
  },

  {
    type: 'thematicStrip',
    size: { w: 1, h: 1 },
    // One species per thematic card, rendered like a `speciesMini` with the
    // theme kicker shown in the text section below the photo. Alternates the
    // accent so a row of these stays visually varied.
    className: THEMATIC_CARD_CLASS,
    build: ({ data, language, uiText }) =>
      data.thematicStripCards
        .slice(0, THEMATIC_PRIMARY_COUNT)
        .map((card, index) =>
          toThematicTileInstance(card, index, language, uiText),
        )
        .filter((x): x is NonNullable<typeof x> => x !== null),
  },

  {
    type: 'seasonality',
    size: { w: 2, h: 1 },
    className: 'bento-card bento-card--season-how accent-paper',
    build: ({ data, language, uiText }) => {
      const ys = data.yearSummary
      const fmtCount = (n: number) =>
        n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
          : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
          : String(n)
      const monthLabels = Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(language, { month: 'short' })
          .format(new Date(2000, i, 1))
          .slice(0, 1)
          .toUpperCase(),
      )

      // Compute % of observations from the last 10 years
      const recentPct = (() => {
        if (!ys || ys.yearCounts.length < 2) return null
        const cutoff = new Date().getFullYear() - 9
        const total = ys.yearCounts.reduce((s, e) => s + e.count, 0)
        if (total === 0) return null
        const recent = ys.yearCounts
          .filter((e) => e.year >= cutoff)
          .reduce((s, e) => s + e.count, 0)
        return Math.round((recent / total) * 100)
      })()

      // How-we-know sources (merged from standalone card)
      const topRecords = data.recordsBreakdown.slice(0, 2)
      const restRecords = data.recordsBreakdown.slice(2)
      const restShare = restRecords.reduce((s, r) => s + r.share, 0)

      // Stacked-bar segments for "How we know": top-2 + optional rest bucket.
      type HowSeg = {
        key: string
        label: string
        share: number
        kind: 'primary' | 'secondary' | 'rest'
      }
      const howSegments: HowSeg[] = [
        ...topRecords.map((r, i) => ({
          key: r.key,
          label: uiText.poster.evidenceLabels[r.key] ?? r.label,
          share: r.share,
          kind: (i === 0 ? 'primary' : 'secondary') as HowSeg['kind'],
        })),
        ...(restShare > 0.005
          ? [
              {
                key: '_rest',
                label: uiText.poster.otherSources(restRecords.length),
                share: restShare,
                kind: 'rest' as const,
              },
            ]
          : []),
      ]

      return [
        {
          id: 'seasonality',
          slotId: 'seasonality',
          render: () => (
            <div className="bento-season-how">
              <div className="bento-season-how__left">
                {ys && (
                  <div className="bento-season__topmeta">
                    <span className="bento-season__since">
                      {uiText.poster.recordsSince(ys.firstYear)}
                    </span>
                  </div>
                )}
                <div className="bento-season-bars" aria-label={uiText.poster.monthlyObservations}>
                  {data.seasonalityData.map((val, i) => {
                    const ratio = data.maxSeasonality > 0 ? val / data.maxSeasonality : 0
                    const monthLabel = monthLabels[i] ?? MONTH[i]
                    return (
                      <div key={`m-${i}`} className="bento-season-bars__col">
                        <div className="bento-season-bars__track">
                          <div
                            className="bento-season-bars__bar"
                            style={{ height: `${Math.max(ratio * 100, 3)}%` }}
                            title={`${monthLabel} · ${fmtCount(val)}`}
                          />
                        </div>
                        <span className="bento-season-bars__label">{monthLabel}</span>
                      </div>
                    )
                  })}
                </div>
                {ys && (
                  <div className="bento-season__footer">
                    <span className="bento-season__chip">
                      {uiText.poster.peakYear(ys.peakYear, fmtCount(ys.peakYearCount))}
                    </span>
                    {recentPct !== null && (
                      <span className="bento-season__chip">
                        {uiText.poster.inLastDecade(recentPct)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {howSegments.length > 0 && (
                <div className="bento-season-how__right">
                  <span className="bento-card__kicker bento-card__kicker--evidence">
                    {uiText.poster.evidenceMix}
                  </span>
                  <div className="bento-evidence__bar" aria-hidden="true">
                    {howSegments.map((seg) => (
                      <span
                        key={seg.key}
                        className={`bento-evidence__seg bento-evidence__seg--${seg.kind}`}
                        style={{ flexGrow: Math.max(seg.share, 0.02) }}
                      />
                    ))}
                  </div>
                  <ul className="bento-evidence">
                    {howSegments.map((seg) => (
                      <li
                        key={seg.key}
                        className={`bento-evidence__row bento-evidence__row--${seg.kind}`}
                      >
                        <span className="bento-evidence__dot" aria-hidden="true" />
                        <span className="bento-evidence__pct">{fmtPct(seg.share)}</span>
                        <span className="bento-evidence__label">{seg.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
        },
      ]
    },
  },

  {
    type: 'atRisk',
    size: { w: 1, h: 1 },
    className: 'bento-card bento-card--mini bento-card--at-risk accent-paper',
    build: ({ data, contentSeed, language, uiText }) => {
      // Shuffle the *unfiltered* pool first so the order is deterministic
      // across reloads (only depends on data + seed). We intentionally do
      // NOT filter by `imageUrl` here — image resolution is best-effort
      // and lands asynchronously via background retries. Filtering would
      // shrink the tile count when an image hasn't loaded yet, leaving
      // empty grid cells. The placeholder in `renderSpeciesImage` covers
      // the brief gap; the real image swaps in once it resolves.
      const fullPool = data.conservationSnapshot.threatenedSpecies
      if (fullPool.length === 0) return []
      const ordered = seededShuffle(
        fullPool,
        `atRisk:${fullPool[0]?.iucnCategory ?? 'x'}:${contentSeed}`,
      )
      const picks = ordered.slice(0, 2)
      if (picks.length === 0) return []
      return picks.map((sp, i) => ({
        id: `at-risk-${i}`,
        slotId: `at-risk-${i}`,
        speciesIds: [sp.id],
        className: `bento-card bento-card--mini bento-card--at-risk accent-paper ${speciesPatternClass(sp)}`,
        render: () => (
          <>
            {renderSpeciesImage({
              src: sp.squareImageUrl ?? sp.imageUrl,
              alt: sp.commonName,
              className: 'bento-mini__img',
              uiText,
            })}
            {renderSpeciesInfoButton(sp)}
            <span className="bento-mini__name">{sp.commonName}</span>
            <span className="bento-mini__sci">{sp.scientificName}</span>
            {sp.popularity ? (
              <span className="bento-mini__count">{sp.popularity.toLocaleString(language)}</span>
            ) : null}
            <span className="bento-mini__ribbon bento-mini__ribbon--danger">
              {uiText.poster.atRiskRibbon(sp.iucnCategory)}
            </span>
          </>
        ),
      }))
    },
  },

  // Signature species — one species over-represented in this place vs the
  // global GBIF baseline. Renders as a 1×1 species card (same visual
  // language as `speciesMini` / `atRisk`) with a ratio chip. The pool is
  // built by `useLiveSignatureSpecies` and trimmed by
  // `dedupeSpeciesAcrossLenses`, so the pick here can never duplicate the
  // hero, an at-risk species, or a thematic strip species. The hook now
  // returns a class-diverse top-3 pool; this card picks one using the
  // current content seed so Regenerate rotates within that pool.
  {
    type: 'signatureSpecies',
    size: { w: 1, h: 1 },
    className:
      'bento-card bento-card--mini bento-card--signature accent-forest',
    build: ({ data, placeName, latitude, longitude, contentSeed, language, uiText }) => {
      // Pick deterministically from the seeded shuffle. We intentionally
      // do NOT filter on `imageUrl` here — image resolution is
      // best-effort and can vary between tab loads (network blips, source
      // rate limits). Filtering by `imageUrl` would let two tabs with the
      // same share URL pick *different* species purely because of image
      // fetch luck, breaking share-link reproducibility. If the chosen
      // species' image fails, `renderSpeciesImage` shows a placeholder;
      // the species identity stays stable across tabs.
      const fullPool = data.signatureSpeciesData
      if (fullPool.length === 0) return []
      const ordered = seededShuffle(
        fullPool,
        `signature:${placeName}:${latitude ?? ''}:${longitude ?? ''}:${contentSeed}`,
      )
      const sp = ordered[0]
      if (!sp) return []
      const r = sp.overRepresentationRatio
      const ratioLabel =
        r >= 10 ? `${Math.round(r)}×` : `${r.toFixed(1)}×`
      return [
        {
          id: 'signature-species',
          slotId: 'signature-species',
          speciesIds: [sp.id],
          className: `bento-card bento-card--mini bento-card--signature accent-forest ${speciesPatternClass(sp)}`,
          render: () => (
            <>
              {renderSpeciesImage({
                src: sp.squareImageUrl ?? sp.imageUrl,
                alt: sp.commonName,
                className: 'bento-mini__img',
                uiText,
              })}
              {renderSpeciesInfoButton(sp)}
              <span className="bento-mini__ribbon bento-mini__ribbon--signature">
                {uiText.poster.signatureRibbon(ratioLabel)}
              </span>
              <span className="bento-mini__name">{sp.commonName}</span>
              <span className="bento-mini__sci">{sp.scientificName}</span>
              {sp.popularity ? (
                <span className="bento-mini__count">{sp.popularity.toLocaleString(language)}</span>
              ) : null}
            </>
          ),
        },
      ]
    },
  },

  {
    type: 'sources',
    size: { w: 2, h: 1 },
    className: 'bento-card accent-gold bento-sources',
    build: ({ shareUrl, uiText }) => {
      const brandLogoSrc = `${import.meta.env.BASE_URL}logo.svg`
      const gbifLogoSrc = `${import.meta.env.BASE_URL}gbif-logo.png`
      return [
        {
          id: 'sources',
          slotId: 'sources',
          render: () => (
            <>
              <div className="bento-sources__text">
                <div className="bento-sources__brand" aria-label="Bee Around">
                  <img
                    src={brandLogoSrc}
                    alt=""
                    className="bento-sources__brand-logo"
                    loading="eager"
                    decoding="async"
                  />
                  <span className="bento-sources__brand-name">Bee Around</span>
                </div>
                <span className="bento-sources__separator" aria-hidden="true" />
                <span className="bento-card__kicker">{uiText.poster.dataFrom}</span>
                <a
                  className="bento-sources__logo-link"
                  href="https://www.gbif.org/dataset/search"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open GBIF datasets page"
                  title="Open GBIF datasets page"
                >
                  <img
                    src={gbifLogoSrc}
                    alt="GBIF"
                    className="bento-sources__logo"
                    loading="eager"
                    decoding="async"
                  />
                </a>
                <p className="bento-sources__line">Global Biodiversity Information Facility</p>
              </div>
              {shareUrl && (
                <div className="bento-sources__qr" aria-label={uiText.poster.scanQr}>
                  <QRCodeSVG
                    value={shareUrl}
                    size={160}
                    bgColor="transparent"
                    fgColor="rgb(var(--color-ink))"
                    level="L"
                    marginSize={0}
                  />
                </div>
              )}
            </>
          ),
        },
      ]
    },
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Public API used by the poster page.
// ───────────────────────────────────────────────────────────────────────────

export interface BuildTilesArgs {
  placeName: string
  /** Latitude of the selected place (degrees). Used by the title-tile globe. */
  latitude?: number
  /** Longitude of the selected place (degrees). Used by the title-tile globe. */
  longitude?: number
  language: UiLanguage
  uiText: UiText
  data: LensData
  /** Regenerate seed used for tile-level random picks (species cards, etc.). */
  contentSeed: number
  /** Current shareable URL (place + seed). Used by the sources QR. */
  shareUrl?: string
}

/** Walk the card registry and produce concrete tiles for the current data. */
export function buildBentoTiles(args: BuildTilesArgs): Tile[] {
  const ctx: CardBuildCtx = args
  const tiles: Tile[] = []
  const areaBudget = POSTER_GRID_AREA
  let usedArea = 0
  for (const def of CARD_DEFS) {
    for (const inst of def.build(ctx)) {
      const w = inst.size?.w ?? def.size.w
      const h = inst.size?.h ?? def.size.h
      const area = w * h
      // Fixed-size poster should not grow when new cards are added.
      // Skip overflow tiles in registry order.
      if (usedArea + area > areaBudget) continue
      tiles.push({
        id: inst.id,
        w,
        h,
        anchor: inst.anchor ?? def.anchor,
        pin: inst.pin ?? def.pin,
        className: inst.className ?? def.className,
        render: inst.render,
        slotId: inst.slotId,
        speciesIds: inst.speciesIds,
      })
      usedArea += area
    }
  }
  return tiles
}

/**
 * Optional 1x1 fallback thematic tiles.
 *
 * Uses the same precomputed thematic pool and rendering logic as the main
 * thematic cards, but targets the candidates after the 2 primary slots.
 * The caller decides how many of these to append when post-lock merges
 * create 1x1 gaps.
 */
export function buildThematicBackupTiles(
  data: LensData,
  language: UiLanguage,
  uiText: UiText,
): Tile[] {
  return data.thematicStripCards
    .slice(THEMATIC_PRIMARY_COUNT)
    .map((card, offset) =>
      toThematicTileInstance(
        card,
        THEMATIC_PRIMARY_COUNT + offset,
        language,
        uiText,
      ),
    )
    .filter((inst): inst is NonNullable<typeof inst> => inst !== null)
    .map((inst) => ({
      id: inst.id,
      w: inst.size?.w ?? 1,
      h: inst.size?.h ?? 1,
      anchor: inst.anchor,
      pin: inst.pin,
      className: inst.className ?? THEMATIC_CARD_CLASS,
      render: inst.render,
      slotId: inst.slotId,
      speciesIds: inst.speciesIds,
    }))
}

/**
 * Optional 1x1 fallback species tiles.
 *
 * Drawn from unused threatened species (after the 2 primary at-risk slots)
 * and unused signature species (after the 1 primary signature slot). The
 * caller decides how many to append when post-lock merges or build-time
 * dropouts leave 1x1 gaps. Rendered as plain species mini cards (no
 * ribbon) so they read as "noteworthy species" without claiming a
 * specialised slot identity.
 */
export function buildSpeciesBackupTiles(
  data: LensData,
  language: UiLanguage,
  uiText: UiText,
): Tile[] {
  const tiles: Tile[] = []
  const seen = new Set<string>()

  const pushSpeciesTile = (
    sp: SpeciesInfoCard,
    slotId: string,
  ) => {
    if (seen.has(sp.id)) return
    seen.add(sp.id)
    tiles.push({
      id: slotId,
      slotId,
      speciesIds: [sp.id],
      w: 1,
      h: 1,
      className: `bento-card bento-card--mini accent-paper ${speciesPatternClass(sp)}`,
      render: () => (
        <>
          {renderSpeciesImage({
            src: sp.squareImageUrl ?? sp.imageUrl,
            alt: sp.commonName,
            className: 'bento-mini__img',
            uiText,
          })}
          {renderSpeciesInfoButton(sp)}
          <span className="bento-mini__name">{sp.commonName}</span>
          <span className="bento-mini__sci">{sp.scientificName}</span>
          {sp.popularity ? (
            <span className="bento-mini__count">{sp.popularity.toLocaleString(language)}</span>
          ) : null}
        </>
      ),
    })
  }

  // Threatened species past the 2 atRisk primaries.
  data.conservationSnapshot.threatenedSpecies.slice(2).forEach((sp, i) => {
    pushSpeciesTile(sp, `species-backup-threatened-${i}`)
  })
  // Signature species past the 1 signature primary.
  data.signatureSpeciesData.slice(1).forEach((sp, i) => {
    pushSpeciesTile(sp, `species-backup-signature-${i}`)
  })
  // Secondary species inside each thematic strip (every strip renders only
  // its [0]). These are real, already image-resolved, dedup-cleared species
  // that would otherwise go unused. They give the gap-filler a pool deep
  // enough to always cover the 1–2 cell shortfall that appears when
  // cross-lens dedup drains the thematic/atRisk/signature slots — the
  // root cause of the stray empty tiles on species-rich places.
  data.thematicStripCards.forEach((card) => {
    card.species.slice(1).forEach((sp, i) => {
      pushSpeciesTile(sp, `species-backup-thematic-${card.id}-${i}`)
    })
  })
  return tiles
}

/** Pad with invisible 1×1 fillers. When `targetArea` is set, pad up to that
 *  exact total area (used by the fixed 6×4 poster).
 *  Otherwise, pad to the next multiple of `gridW` so a rectangle can be
 *  tiled with no leftover. */
export function padToRectangle(
  tiles: Tile[],
  gridW: number,
  targetArea?: number,
): Tile[] {
  const totalArea = tiles.reduce((s, t) => s + t.w * t.h, 0)
  let fillerCount: number
  if (typeof targetArea === 'number') {
    fillerCount = Math.max(0, targetArea - totalArea)
  } else {
    const remainder = totalArea % gridW
    if (remainder === 0) return tiles
    fillerCount = gridW - remainder
  }
  if (fillerCount === 0) return tiles
  const fillers: Tile[] = Array.from({ length: fillerCount }, (_, i) => ({
    id: `filler-${i}`,
    w: 1,
    h: 1,
    className: 'bento-card bento-card--filler',
    render: () => null,
  }))
  return [...tiles, ...fillers]
}
