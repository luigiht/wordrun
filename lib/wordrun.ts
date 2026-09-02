/** [lat, lon] */
export type LatLng = [number, number]

/** A glyph is a list of strokes; a stroke is a polyline in font units. */
type Glyph = [number, number][][]

/**
 * Single-stroke ("engraving") alphabet on a 4 x 6 grid, designed so each letter
 * can be drawn without lifting the pen more than a couple of times.
 */
export const FONT: Record<string, Glyph> = {
  A: [[[0, 0], [2, 6], [4, 0]], [[1, 2.6], [3, 2.6]]],
  B: [[[0, 0], [0, 6], [3, 6], [3, 3.2], [0, 3.2], [3, 3.2], [3.6, 1.6], [3, 0], [0, 0]]],
  C: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1]]],
  D: [[[0, 0], [0, 6], [2.6, 6], [4, 4.4], [4, 1.6], [2.6, 0], [0, 0]]],
  E: [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3], [3, 3]]],
  F: [[[0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 3], [2.2, 3]]],
  H: [[[0, 0], [0, 6]], [[0, 3], [4, 3]], [[4, 6], [4, 0]]],
  I: [[[0, 6], [0, 0]]],
  J: [[[3, 6], [3, 1], [2, 0], [1, 0], [0, 1]]],
  K: [[[0, 0], [0, 6]], [[4, 6], [0, 2.8], [4, 0]]],
  L: [[[0, 6], [0, 0], [4, 0]]],
  M: [[[0, 0], [0, 6], [2, 2.6], [4, 6], [4, 0]]],
  N: [[[0, 0], [0, 6], [4, 0], [4, 6]]],
  O: [[[1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0]]],
  P: [[[0, 0], [0, 6], [3, 6], [4, 4.8], [3.2, 3.4], [0, 3.4]]],
  Q: [[[1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0]], [[2.6, 1.4], [4.4, -0.4]]],
  R: [[[0, 0], [0, 6], [3, 6], [4, 4.8], [3.2, 3.4], [0, 3.4]], [[1.4, 3.4], [4, 0]]],
  S: [[[4, 5.2], [3, 6], [1, 6], [0, 5], [0.8, 3.6], [3.2, 2.4], [4, 1], [3, 0], [1, 0], [0, 0.8]]],
  T: [[[0, 6], [4, 6]], [[2, 6], [2, 0]]],
  U: [[[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]]],
  V: [[[0, 6], [2, 0], [4, 6]]],
  W: [[[0, 6], [1, 0], [2, 4], [3, 0], [4, 6]]],
  X: [[[0, 6], [4, 0]], [[0, 0], [4, 6]]],
  Y: [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]],
  Z: [[[0, 6], [4, 6], [0, 0], [4, 0]]],
  ' ': [],
}

/** Advance width overrides; everything else is 4 font units wide. */
export const WIDTHS: Record<string, number> = { I: 0, ' ': 2 }

const DEFAULT_WIDTH = 4
const LETTER_SPACING = 1.6
const GLYPH_HEIGHT = 6
const METERS_PER_DEGREE_LAT = 111320

export type City = { name: string; label: string; lat: number; lon: number }

export const CITIES: City[] = [
  { name: 'London', label: 'Starts in Marylebone, London', lat: 51.517, lon: -0.158 },
  { name: 'New York', label: 'Starts near Central Park, New York', lat: 40.775, lon: -73.968 },
  { name: 'Paris', label: 'Starts near the Jardin du Luxembourg, Paris', lat: 48.845, lon: 2.34 },
  { name: 'Berlin', label: 'Starts near Volkspark Friedrichshain, Berlin', lat: 52.527, lon: 13.436 },
  { name: 'Tokyo', label: 'Starts near Yoyogi Park, Tokyo', lat: 35.669, lon: 139.7 },
]

/** Metres between two nearby points, using a local equirectangular approximation. */
export function metersBetween(a: LatLng, b: LatLng): number {
  const dLat = (b[0] - a[0]) * METERS_PER_DEGREE_LAT
  const dLon = (b[1] - a[1]) * METERS_PER_DEGREE_LAT * Math.cos((a[0] * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}

export function polylineLength(points: LatLng[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += metersBetween(points[i - 1], points[i])
  return total
}

/** Lay the word out as geographic strokes, with `origin` as the baseline start. */
export function buildIdeal(word: string, origin: LatLng, letterHeightM: number): LatLng[][] {
  const [lat, lon] = origin
  const scale = letterHeightM / GLYPH_HEIGHT // metres per font unit
  const mLat = 1 / METERS_PER_DEGREE_LAT
  const mLon = 1 / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180))
  const strokes: LatLng[][] = []
  let cursor = 0
  for (const ch of word) {
    const glyph = FONT[ch] ?? []
    const width = WIDTHS[ch] !== undefined ? WIDTHS[ch] : DEFAULT_WIDTH
    for (const stroke of glyph) {
      strokes.push(stroke.map(([x, y]): LatLng => [lat + y * scale * mLat, lon + (cursor + x) * scale * mLon]))
    }
    cursor += width + LETTER_SPACING
  }
  return strokes
}

/** Flatten strokes into a waypoint list with roughly `spacingM` between points. */
export function densify(strokes: LatLng[][], spacingM: number): LatLng[] {
  const points: LatLng[] = []
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.length; i++) {
      if (i === 0) {
        points.push(stroke[i])
        continue
      }
      const a = stroke[i - 1]
      const b = stroke[i]
      const steps = Math.max(1, Math.round(metersBetween(a, b) / spacingM))
      for (let k = 1; k <= steps; k++) {
        points.push([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps])
      }
    }
  }
  return points
}

export function sanitizeWord(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z ]/g, '')
}

export function toGpx(word: string, coords: LatLng[]): string {
  const pts = coords
    .map((p) => `    <trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"></trkpt>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wordrun" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Wordrun — ${word.toUpperCase()}</name><trkseg>
${pts}
  </trkseg></trk>
</gpx>`
}
