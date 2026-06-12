/**
 * printPosterToPdf — Track A poster export.
 *
 * Uses the browser's native print pipeline to produce a high-fidelity
 * PDF via the user's "Save as PDF" destination. Text and inline SVG
 * stay vector; only raster images and the WebGL globe canvas are
 * rasterised, at whatever DPI the user picks in the print dialog.
 *
 * Why not html2canvas / jsPDF? Those rasterise the whole poster into
 * a single bitmap, which defeats "high resolution" and chokes on
 * modern CSS (grid, clamp, filters) and CORS-tainted images.
 *
 * Kept deliberately tiny and dependency-free so swapping in Track B
 * (Puppeteer) later doesn't touch the React tree.
 */

export interface PrintPosterOptions {
  /** Grid columns from the packer — used to size the @page rule. */
  gridW: number
  /** Grid rows from the packer — used to size the @page rule. */
  gridH: number
  /** Place name; becomes the suggested PDF filename in Chrome. */
  placeName: string
  /** Optional seed; appended to the filename so different shuffles save distinctly. */
  seed?: number
}

/** Longest physical edge of the printed page, in millimetres. */
const PAGE_LONG_EDGE_MM = 420 // A3 long edge balances crisp export with responsive PDF viewing.
/** Keep a tiny safety margin for browser print rounding quirks. */
const PAGE_SAFE_MARGIN_MM = 2

function sanitizeFilename(input: string): string {
  return (
    input
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'poster'
  )
}

/**
 * Trigger the browser print dialog with a page size that exactly
 * matches the current poster aspect ratio, then clean up on
 * `afterprint`. Safe to call multiple times.
 */
export function printPosterToPdf(opts: PrintPosterOptions): void {
  const { gridW, gridH, placeName, seed } = opts

  // Derive page dims from the grid aspect ratio so the printed sheet
  // matches the on-screen poster exactly (no letterboxing, no crop).
  const ratio = gridW / gridH
  const longEdge = PAGE_LONG_EDGE_MM - PAGE_SAFE_MARGIN_MM * 2
  const [pageW, pageH] =
    ratio >= 1
      ? [longEdge, longEdge / ratio]
      : [longEdge * ratio, longEdge]

  // Inject (or replace) the dynamic @page rule. Using a dedicated <style>
  // node keeps it isolated from the static print CSS and easy to remove.
  const STYLE_ID = 'bee-around-print-page'
  document.getElementById(STYLE_ID)?.remove()
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.media = 'print'
  style.textContent = `@page { size: ${pageW.toFixed(2)}mm ${pageH.toFixed(2)}mm; margin: 0; }`
  document.head.appendChild(style)

  // Title becomes the default filename in Chrome's Save-as-PDF dialog.
  const prevTitle = document.title
  const filenameBase = sanitizeFilename(
    `Bee Around — ${placeName}${seed != null ? ` (seed ${seed})` : ''}`,
  )
  document.title = filenameBase

  const cleanup = () => {
    document.title = prevTitle
    style.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  // Defer one frame so the title change is committed before the dialog opens.
  requestAnimationFrame(() => window.print())
}
