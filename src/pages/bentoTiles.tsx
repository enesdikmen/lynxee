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
 *   - Per-aspect sizes for vertical / square posters: add a `sizesByAspect`
 *     field next to `size` and resolve it in {@link buildBentoTiles}.
 *   - Priority / max-instance caps per card type for tight layouts.
 */
import type { ReactNode } from 'react'
import type { useLensData } from '../hooks/useLensData'
import type { Anchor } from '../lib/gridPacker'
import Globe from '../components/Globe'

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
  className: string
  render: () => ReactNode
}

type LensData = ReturnType<typeof useLensData>

/** Poster shapes the user can pick from in the toolbar. Each aspect resolves
 *  to a grid width (and optional fixed height) in {@link POSTER_ASPECTS}. */
export type PosterAspect = 'horizontal' | 'vertical' | 'square'

/** Grid dimensions per aspect. `fixedH` forces the packer to use that exact
 *  height (used by the curated square poster); otherwise height is derived
 *  from total tile area. */
export const POSTER_ASPECTS: Record<
  PosterAspect,
  { label: string; gridW: number; fixedH?: number }
> = {
  horizontal: { label: 'Wide', gridW: 6 },
  vertical:   { label: 'Tall', gridW: 4 },
  square:     { label: 'Square', gridW: 4, fixedH: 4 },
}

/** What `buildBentoTiles` hands to each card. Lean on purpose. */
export type CardBuildCtx = {
  placeName: string
  latitude?: number
  longitude?: number
  data: LensData
  aspect: PosterAspect
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
  className?: string
}

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
  /** Restrict this card to specific poster aspects. Undefined = all aspects. */
  aspects?: PosterAspect[]
  /** Produce tile instances for the current context. Return `[]` to skip. */
  build: (ctx: CardBuildCtx) => TileInstance[]
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

// ───────────────────────────────────────────────────────────────────────────
// Card registry. Each entry is self-contained: type, size, placement, style,
// and a `build` that decides eligibility and produces tile instances.
// ───────────────────────────────────────────────────────────────────────────

export const CARD_DEFS: CardDef[] = [
  {
    type: 'title',
    size: { w: 2, h: 1 },
    pin: 'top-left',
    className: 'bento-card bento-card--title accent-gold',
    build: ({ placeName, latitude, longitude }) => [
      {
        id: 'title',
        render: () => (
          <div className="bento-title__layout">
            {typeof latitude === 'number' && typeof longitude === 'number' && (
              <Globe className="bento-title__globe" lat={latitude} lon={longitude} />
            )}
            <div className="bento-title__text">
              <h1 className="bento-title">
                <span className="bento-title__place">{placeName}</span>
                <span className="bento-title__sub">Biodiversity Portrait</span>
              </h1>
            </div>
          </div>
        ),
      },
    ],
  },

  {
    type: 'sightings',
    size: { w: 1, h: 1 },
    className: 'bento-card bento-card--sightings accent-ink',
    build: ({ data }) => {
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
      return [
        {
          id: 'sightings',
          render: () => (
            <>
              <span className="bento-card__kicker">Sightings on GBIF</span>
              <span className="bento-sightings__num">
                {data.totalRecords ? data.totalRecords.toLocaleString() : '—'}
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
    build: ({ data }) => {
      const hero = data.topSpeciesData[0]
      if (!hero) return []
      return [
        {
          id: 'hero',
          render: () => (
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
          ),
        },
      ]
    },
  },

  {
    type: 'speciesMini',
    size: { w: 1, h: 1 },
    className: 'bento-card bento-card--mini accent-paper',
    build: ({ data, aspect }) => {
      // Square poster only has room for 3 minis; wider posters get up to 5.
      const max = aspect === 'square' ? 3 : 5
      return data.topSpeciesData.slice(1, 1 + max).map((sp) => ({
        id: `sp-${sp.id}`,
        render: () => (
          <>
            <img src={sp.imageUrl} alt={sp.commonName} className="bento-mini__img" loading="lazy" />
            <span className="bento-mini__name">{sp.commonName}</span>
            <span className="bento-mini__sci">{sp.scientificName}</span>
            {sp.popularity ? (
              <span className="bento-mini__count">{sp.popularity.toLocaleString()}</span>
            ) : null}
          </>
        ),
      }))
    },
  },

  {
    type: 'thematicStrip',
    aspects: ['horizontal', 'vertical'],
    size: { w: 1, h: 1 },
    // One species per thematic card, rendered like a `speciesMini` with the
    // theme kicker shown as a small ribbon over the image. Alternates the
    // accent so a row of these stays visually varied.
    className: 'bento-card bento-card--mini accent-gold',
    build: ({ data }) =>
      data.thematicStripCards
        .map((card, index) => {
          const sp = card.species[0]
          if (!sp) return null
          return {
            id: `thematic-${card.id}`,
            className:
              'bento-card bento-card--mini ' +
              (index % 2 === 0 ? 'accent-gold' : 'accent-forest'),
            render: () => (
              <>
                <img
                  src={sp.squareImageUrl ?? sp.imageUrl}
                  alt={sp.commonName}
                  className="bento-mini__img"
                  loading="lazy"
                />
                <span className="bento-mini__ribbon">{card.kicker}</span>
                <span className="bento-mini__name">{sp.commonName}</span>
                <span className="bento-mini__sci">{sp.scientificName}</span>
              </>
            ),
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
  },

  {
    type: 'seasonality',
    size: { w: 2, h: 1 },
    className: 'bento-card accent-paper',
    build: ({ data }) => [
      {
        id: 'seasonality',
        render: () => (
          <>
            <span className="bento-card__kicker">When life is observed</span>
            <div className="bento-season">
              {data.seasonalityData.map((val, i) => {
                const ratio = data.maxSeasonality > 0 ? val / data.maxSeasonality : 0
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
        ),
      },
    ],
  },

  {
    type: 'iucn',
    size: { w: 1, h: 1 },
    className: 'bento-card bento-card--iucn accent-paper',
    build: ({ data }) => {
      const snap = data.conservationSnapshot
      if (snap.totalAssessedSpecies <= 0) return []
      const get = (s: string) =>
        snap.categoryBreakdown.find((c) => c.status === s)?.count ?? 0
      const buckets = [
        { label: 'Doing well', count: get('LC'), color: '#4ade80' },
        { label: 'Watch list', count: get('NT') + get('DD'), color: '#facc15' },
        { label: 'At risk', count: get('VU') + get('EN') + get('CR'), color: '#f87171' },
      ]
      return [
        {
          id: 'iucn',
          render: () => (
            <>
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
            </>
          ),
        },
      ]
    },
  },

  {
    type: 'atRisk',
    size: { w: 1, h: 1 },
    className: 'bento-card bento-card--mini bento-card--at-risk accent-paper',
    build: ({ data }) => {
      const sp = data.conservationSnapshot.threatenedSpecies[0]
      if (!sp) return []
      return [
        {
          id: 'at-risk',
          render: () => (
            <>
              <img
                src={sp.squareImageUrl ?? sp.imageUrl}
                alt={sp.commonName}
                className="bento-mini__img"
                loading="lazy"
              />
              <span className="bento-mini__ribbon bento-mini__ribbon--danger">
                At risk · {sp.iucnCategory}
              </span>
              <span className="bento-mini__name">{sp.commonName}</span>
              <span className="bento-mini__sci">{sp.scientificName}</span>
            </>
          ),
        },
      ]
    },
  },

  {
    type: 'howWeKnow',
    size: { w: 1, h: 1 },
    aspects: ['horizontal', 'vertical'],
    className: 'bento-card bento-card--how accent-ink',
    build: ({ data }) => {
      // 1×1 has room for the top 2 sources only; the rest collapse into a
      // single "+ N others" summary row.
      const topRecords = data.recordsBreakdown.slice(0, 2)
      if (topRecords.length === 0) return []
      const restRecords = data.recordsBreakdown.slice(2)
      const restShare = restRecords.reduce((s, r) => s + r.share, 0)
      return [
        {
          id: 'how-we-know',
          render: () => (
            <>
              <span className="bento-card__kicker">How we know this</span>
              <ul className="bento-how__rows">
                {topRecords.map((item) => (
                  <li key={item.key} className="bento-how__row">
                    <span className="bento-how__pct">{fmtPct(item.share)}</span>
                    <span className="bento-how__label">{item.label}</span>
                  </li>
                ))}
                {restShare > 0.005 && (
                  <li className="bento-how__row bento-how__row--rest">
                    <span className="bento-how__pct">{fmtPct(restShare)}</span>
                    <span className="bento-how__label">
                      + {restRecords.length} other source{restRecords.length === 1 ? '' : 's'}
                    </span>
                  </li>
                )}
              </ul>
            </>
          ),
        },
      ]
    },
  },

  {
    type: 'sources',
    size: { w: 2, h: 1 },
    pin: 'bottom-right',
    className: 'bento-card accent-gold',
    build: ({ data }) => [
      {
        id: 'sources',
        render: () => (
          <>
            <span className="bento-card__kicker">Sources</span>
            <p className="bento-card__sub">
              <strong>GBIF</strong> · <strong>Lynxee</strong>
            </p>
            {data.datasetSummaries.length > 0 && (
              <p className="bento-datasets">{data.datasetSummaries[0]?.title}</p>
            )}
          </>
        ),
      },
    ],
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
  data: LensData
  /** Which poster shape we are building for. Cards may opt out per aspect
   *  via their `aspects` field, and may also adapt their content (e.g.
   *  `speciesMini` emits fewer tiles in square mode). */
  aspect: PosterAspect
}

/** Walk the card registry and produce concrete tiles for the current data. */
export function buildBentoTiles(args: BuildTilesArgs): Tile[] {
  const ctx: CardBuildCtx = args
  const tiles: Tile[] = []
  for (const def of CARD_DEFS) {
    if (def.aspects && !def.aspects.includes(args.aspect)) continue
    for (const inst of def.build(ctx)) {
      tiles.push({
        id: inst.id,
        w: inst.size?.w ?? def.size.w,
        h: inst.size?.h ?? def.size.h,
        anchor: inst.anchor ?? def.anchor,
        pin: inst.pin ?? def.pin,
        className: inst.className ?? def.className,
        render: inst.render,
      })
    }
  }
  return tiles
}

/** Pad with invisible 1×1 fillers. When `targetArea` is set, pad up to that
 *  exact total area (used for fixed-height posters like the 4×4 square).
 *  Otherwise, pad to the next multiple of `gridW` so a flexible-height
 *  rectangle can be tiled with no leftover. */
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
