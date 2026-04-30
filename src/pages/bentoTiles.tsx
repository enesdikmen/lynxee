/**
 * Bento tile factory.
 *
 * Builds the list of tiles displayed on the bento poster from the lens data.
 * Every tile is one of the types declared in {@link TILE_SPECS}, which is the
 * single source of truth for tile size (w × h), placement anchor, and base
 * className. To change a tile's size or accent, edit `TILE_SPECS` only — the
 * builder below just plugs in the data.
 */
import type { ReactNode } from 'react'
import type { useLensData } from '../hooks/useLensData'
import type { Anchor } from '../lib/gridPacker'

/** Corner the tile should be hard-pinned to. Resolved against the current
 *  grid size in {@link BentoPoster} so `bottom-right` follows the height. */
export type PinCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export type Tile = {
  id: string
  w: 1 | 2
  h: 1 | 2
  /** Soft preference — packer tries this corner first but may place elsewhere. */
  anchor?: Anchor
  /** Hard pin — packer is forced to put the tile in this corner. */
  pin?: PinCorner
  className: string
  render: () => ReactNode
}

/**
 * Central registry of tile types. Add a new card by adding an entry here and
 * a `makeTile(type, …)` call in {@link buildBentoTiles}.
 *
 * - `anchor` = soft placement preference (best-effort).
 * - `pin`    = hard corner pin (resolved to (x,y) at pack time).
 *   Use `pin` for boxes whose position is part of the design; use `anchor`
 *   for boxes that just want to lean a certain direction.
 */
export const TILE_SPECS = {
  title:        { w: 2, h: 1, className: 'bento-card bento-card--title accent-gold', pin: 'top-left' as PinCorner },
  stats:        { w: 2, h: 1, className: 'bento-card bento-card--stats accent-ink' },
  hero:         { w: 2, h: 2, className: 'bento-card bento-card--hero accent-forest' },
  inSeason:     { w: 2, h: 1, className: 'bento-card accent-gold' },
  smallWonders: { w: 2, h: 1, className: 'bento-card accent-forest' },
  speciesMini:  { w: 1, h: 1, className: 'bento-card bento-card--mini accent-paper' },
  seasonality:  { w: 2, h: 1, className: 'bento-card accent-paper' },
  iucn:         { w: 2, h: 1, className: 'bento-card bento-card--iucn accent-paper' },
  howWeKnow:    { w: 2, h: 1, className: 'bento-card bento-card--how accent-ink' },
  sources:      { w: 1, h: 1, className: 'bento-card accent-gold', pin: 'bottom-right' as PinCorner },
} as const satisfies Record<
  string,
  { w: 1 | 2; h: 1 | 2; className: string; anchor?: Anchor; pin?: PinCorner }
>

export type TileType = keyof typeof TILE_SPECS

function makeTile(type: TileType, id: string, render: () => ReactNode): Tile {
  const spec = TILE_SPECS[type]
  return {
    id,
    w: spec.w,
    h: spec.h,
    className: spec.className,
    anchor: 'anchor' in spec ? (spec.anchor as Anchor | undefined) : undefined,
    pin: 'pin' in spec ? (spec.pin as PinCorner | undefined) : undefined,
    render,
  }
}

const MONTH = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

const fmtPct = (share: number) => {
  if (share >= 0.1) return `${Math.round(share * 100)}%`
  if (share >= 0.01) return `${(share * 100).toFixed(1)}%`
  return '<1%'
}

type LensData = ReturnType<typeof useLensData>

export interface BuildTilesArgs {
  placeName: string
  data: LensData
}

export function buildBentoTiles({
  placeName,
  data,
}: BuildTilesArgs): Tile[] {
  const {
    seasonalityData, topSpeciesData, conservationSnapshot,
    kingdomBreakdown, datasetSummaries,
    totalRecords, maxSeasonality,
    recordsBreakdown,
    inSeasonSpecies, smallWondersSpecies,
  } = data

  const hero = topSpeciesData[0]
  const restSpecies = topSpeciesData.slice(1, 6)
  const topRecords = recordsBreakdown.slice(0, 3)
  const restRecords = recordsBreakdown.slice(3)
  const restRecordsShare = restRecords.reduce((s, r) => s + r.share, 0)

  const kingdomTotal = kingdomBreakdown.reduce((s, k) => s + k.count, 0)
  let kingdomSentence = ''
  if (kingdomTotal > 0) {
    const top = kingdomBreakdown
      .slice(0, 3)
      .map((k) => `${k.label.toLowerCase()} (${Math.round((k.count / kingdomTotal) * 100)}%)`)
    kingdomSentence =
      `Mostly ${top[0]}` +
      (top[1] ? `, then ${top[1]}` : '') +
      (top[2] ? `, with a sprinkle of ${top[2]}` : '') +
      '.'
  }

  const tiles: Tile[] = []

  tiles.push(
    makeTile('title', 'title', () => (
      <>
        <span className="bento-kicker">Lynxee Lens</span>
        <h1 className="bento-title">
          <span className="bento-title__place">{placeName}</span>
          <span className="bento-title__sub">Biodiversity Portrait</span>
        </h1>
      </>
    )),
  )

  // Sightings + at-risk numbers, plus the kingdom sentence ("what life looks
  // like here") tucked in as a caption — too thin to deserve its own tile.
  tiles.push(
    makeTile('stats', 'stats', () => (
      <div className="bento-stats">
        <div className="bento-stats__cell">
          <span className="bento-card__kicker">Sightings</span>
          <span className="bento-bignum bento-bignum--sm">
            {totalRecords ? totalRecords.toLocaleString() : '—'}
          </span>
          <span className="bento-card__sub">on GBIF</span>
        </div>
        <div className="bento-stats__divider" />
        <div className="bento-stats__cell">
          <span className="bento-card__kicker">At risk</span>
          <span className="bento-bignum bento-bignum--sm bento-stats__danger">
            {conservationSnapshot.threatenedCount}
          </span>
          <span className="bento-card__sub">may disappear</span>
        </div>
        {kingdomSentence && (
          <p className="bento-stats__caption">
            <span className="bento-stats__caption-kicker">What life looks like here</span>
            {kingdomSentence}
          </p>
        )}
      </div>
    )),
  )

  if (hero) {
    tiles.push(
      makeTile('hero', 'hero', () => (
        <>
          <img src={hero.imageUrl} alt={hero.commonName} className="bento-hero__img" loading="lazy" />
          <div className="bento-hero__body">
            <span className="bento-card__kicker">Most observed species</span>
            <h2 className="bento-hero__name">{hero.commonName}</h2>
            <p className="bento-hero__sci">{hero.scientificName}</p>
            {hero.taxonLine && <span className="bento-hero__taxon">{hero.taxonLine}</span>}
            {hero.popularity ? (
              <span className="bento-hero__count">
                {hero.popularity.toLocaleString()} observations
              </span>
            ) : null}
          </div>
        </>
      )),
    )
  }

  for (const sp of restSpecies) {
    tiles.push(
      makeTile('speciesMini', `sp-${sp.id}`, () => (
        <>
          <img src={sp.imageUrl} alt={sp.commonName} className="bento-mini__img" loading="lazy" />
          <span className="bento-mini__name">{sp.commonName}</span>
          <span className="bento-mini__sci">{sp.scientificName}</span>
          {sp.popularity ? (
            <span className="bento-mini__count">{sp.popularity.toLocaleString()}</span>
          ) : null}
        </>
      )),
    )
  }

  if (inSeasonSpecies.length > 0) {
    tiles.push(
      makeTile('inSeason', 'in-season', () => (
        <>
          <span className="bento-card__kicker">
            🌸 In season · {new Date().toLocaleString('en', { month: 'long' })}
          </span>
          <div className="bento-strip">
            {inSeasonSpecies.slice(0, 3).map((sp) => (
              <div key={sp.id} className="bento-strip__item">
                <img src={sp.squareImageUrl ?? sp.imageUrl} alt={sp.commonName} loading="lazy" />
                <span className="bento-strip__name">{sp.commonName}</span>
              </div>
            ))}
          </div>
        </>
      )),
    )
  }

  if (smallWondersSpecies.length > 0) {
    tiles.push(
      makeTile('smallWonders', 'small-wonders', () => (
        <>
          <span className="bento-card__kicker">🐛 Small wonders</span>
          <div className="bento-strip">
            {smallWondersSpecies.slice(0, 3).map((sp) => (
              <div key={sp.id} className="bento-strip__item">
                <img src={sp.squareImageUrl ?? sp.imageUrl} alt={sp.commonName} loading="lazy" />
                <span className="bento-strip__name">{sp.commonName}</span>
              </div>
            ))}
          </div>
        </>
      )),
    )
  }

  tiles.push(
    makeTile('seasonality', 'seasonality', () => (
      <>
        <span className="bento-card__kicker">When life is observed</span>
        <div className="bento-season">
          {seasonalityData.map((val, i) => {
            const ratio = maxSeasonality > 0 ? val / maxSeasonality : 0
            const size = Math.max(ratio * 38, 8)
            return (
              <div key={`m-${i}`} className="bento-season__col">
                <div className="bento-season__bubble" style={{ width: size, height: size }} />
                <span className="bento-season__label">{MONTH[i]}</span>
              </div>
            )
          })}
        </div>
      </>
    )),
  )

  if (conservationSnapshot.totalAssessedSpecies > 0) {
    const get = (s: string) =>
      conservationSnapshot.categoryBreakdown.find((c) => c.status === s)?.count ?? 0
    const buckets = [
      { label: 'Doing well', count: get('LC'), color: '#4ade80' },
      { label: 'Watch list', count: get('NT') + get('DD'), color: '#facc15' },
      { label: 'At risk', count: get('VU') + get('EN') + get('CR'), color: '#f87171' },
    ]
    const atRiskSpecies = conservationSnapshot.threatenedSpecies.slice(0, 3)
    tiles.push(
      makeTile('iucn', 'iucn', () => (
        <>
          <div className="bento-iucn__head">
            <span className="bento-card__kicker">IUCN Red List</span>
            <div className="bento-iucn__buckets">
              {buckets.map((b) => (
                <span key={b.label} className="bento-iucn__pill">
                  <span className="bento-iucn__dot" style={{ background: b.color }} />
                  <span className="bento-iucn__count">{b.count}</span>
                  <span className="bento-iucn__label">{b.label}</span>
                </span>
              ))}
            </div>
          </div>
          {atRiskSpecies.length > 0 && (
            <>
              <span className="bento-card__kicker bento-card__kicker--danger bento-iucn__risk-kicker">
                At risk near you
              </span>
              <div className="bento-strip bento-iucn__strip">
                {atRiskSpecies.map((sp) => (
                  <div key={sp.id} className="bento-strip__item">
                    <img src={sp.squareImageUrl ?? sp.imageUrl} alt={sp.commonName} loading="lazy" />
                    <span className="bento-strip__name">{sp.commonName}</span>
                    <span className="bento-strip__badge">{sp.iucnCategory}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )),
    )
  }

  if (topRecords.length > 0) {
    tiles.push(
      makeTile('howWeKnow', 'how-we-know', () => (
        <>
          <span className="bento-card__kicker">How we know this</span>
          <ul className="bento-rows">
            {topRecords.map((item) => (
              <li key={item.key} className="bento-row">
                <div className="bento-row__head">
                  <span className="bento-row__pct">{fmtPct(item.share)}</span>
                  <span className="bento-row__label">{item.label}</span>
                </div>
                <div className="bento-row__bar">
                  <div
                    className="bento-row__bar-fill"
                    style={{ width: `${Math.max(item.share * 100, 1.5)}%` }}
                  />
                </div>
              </li>
            ))}
            {restRecordsShare > 0.005 && (
              <li className="bento-row bento-row--rest">
                <span className="bento-row__pct">{fmtPct(restRecordsShare)}</span>
                <span className="bento-row__label">
                  + {restRecords.length} other source{restRecords.length === 1 ? '' : 's'}
                </span>
              </li>
            )}
          </ul>
        </>
      )),
    )
  }

  tiles.push(
    makeTile('sources', 'sources', () => (
      <>
        <span className="bento-card__kicker">Sources</span>
        <p className="bento-card__sub">
          <strong>GBIF</strong> · <strong>Lynxee</strong>
        </p>
        {datasetSummaries.length > 0 && (
          <p className="bento-datasets">{datasetSummaries[0]?.title}</p>
        )}
      </>
    )),
  )

  return tiles
}

/** Pad with invisible 1×1 fillers so total area is a multiple of `gridW`. */
export function padToRectangle(tiles: Tile[], gridW: number): Tile[] {
  const totalArea = tiles.reduce((s, t) => s + t.w * t.h, 0)
  const remainder = totalArea % gridW
  if (remainder === 0) return tiles
  const fillerCount = gridW - remainder
  const fillers: Tile[] = Array.from({ length: fillerCount }, (_, i) => ({
    id: `filler-${i}`,
    w: 1,
    h: 1,
    className: 'bento-card bento-card--filler',
    render: () => null,
  }))
  return [...tiles, ...fillers]
}
