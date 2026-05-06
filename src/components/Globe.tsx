/**
 * Globe — stylized SVG globe rendered with a D3 orthographic projection.
 *
 * Renders a half-globe centered on the given (latitude, longitude) so the
 * pin is always at the visible front. Continent silhouettes come from a
 * pre-built world-atlas TopoJSON (~100 KB), drawn as paper-style shapes
 * to match the bento poster aesthetic.
 */
import { useMemo } from 'react'
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
// world-atlas ships pre-built TopoJSON files. land-110m gives continent
// silhouettes only (no country borders) which suits the stylized look.
import landTopo from 'world-atlas/land-110m.json'

interface Props {
  /** Latitude of the marker (degrees). */
  lat: number
  /** Longitude of the marker (degrees). */
  lon: number
  /** Width of the SVG viewBox. Default 360. */
  width?: number
  /** Height of the SVG viewBox. Default 200. */
  height?: number
  /**
   * Sphere radius as a multiple of `min(width, height)/2`. Values >1 zoom in
   * past the box edges so the sphere is cropped on the top/bottom and reveals
   * a curved edge on the opposite side. Default 1.4.
   */
  zoom?: number
  /**
   * Horizontal position of the sphere's center, as a fraction of `width`.
   * 0.5 = centered, >0.5 pushes the globe to the right. The marker always
   * sits at the sphere center, so this also controls where the marker lands.
   * Default 0.78.
   */
  cx?: number
  /** Vertical center of the sphere as a fraction of `height`. Default 0.5. */
  cy?: number
  className?: string
}

const TOPO = landTopo as unknown as Topology
const LAND = feature(TOPO, TOPO.objects.land) as
  | Feature<Geometry>
  | FeatureCollection<Geometry>

export function Globe({
  lat,
  lon,
  width = 360,
  height = 200,
  zoom = 1.4,
  cx = 0.78,
  cy = 0.5,
  className,
}: Props) {
  const { spherePath, graticulePath, landPath, markerX, markerY, radius } = useMemo(() => {
    const r = (Math.min(width, height) / 2) * zoom
    const tx = width * cx
    const ty = height * cy
    // Rotating to [-lon, -lat] puts the geographic point at the sphere
    // center, so the marker is guaranteed to sit at (tx, ty) on screen.
    const projection = geoOrthographic()
      .scale(r)
      .translate([tx, ty])
      .rotate([-lon, -lat])
      .clipAngle(90)

    const path = geoPath(projection)
    return {
      radius: r,
      spherePath: path({ type: 'Sphere' }) ?? '',
      graticulePath: path(geoGraticule10()) ?? '',
      landPath: path(LAND) ?? '',
      markerX: tx,
      markerY: ty,
    }
  }, [lat, lon, width, height, zoom, cx, cy])

  // Marker scales with sphere radius, not viewBox size, so the pin stays
  // proportionate even when the globe is zoomed in.
  const ringR = radius * 0.075
  const haloR = radius * 0.055
  const dotR = radius * 0.028

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Globe centered at ${lat.toFixed(1)}°, ${lon.toFixed(1)}°`}
    >
      {/* Ocean disc — naturally cropped by the SVG viewBox; the visible edge
          stays a circular arc wherever the sphere meets the box. */}
      <path d={spherePath} className="globe__ocean" />
      <path d={graticulePath} className="globe__graticule" fill="none" />
      <path d={landPath} className="globe__land" />
      <path d={spherePath} className="globe__outline" fill="none" />
      <g className="globe__marker" transform={`translate(${markerX} ${markerY})`}>
        {/* Layered halo: paper ring + ink ring + gold core. This stack
            reads against any background (dark ocean, cream land, gold
            wash) without needing per-context tuning. */}
        <circle r={ringR} className="globe__marker-ring" />
        <circle r={haloR} className="globe__marker-halo" />
        <circle r={dotR} className="globe__marker-dot" />
      </g>
    </svg>
  )
}

export default Globe
