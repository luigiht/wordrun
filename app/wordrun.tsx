'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLngBoundsLiteral, LatLngTuple, LayerGroup, Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './wordrun.module.css'
import { FAQS, type Faq } from '@/lib/faq'
import { geocode, snapToStreets } from '@/lib/osm'
import {
  CITIES,
  buildIdeal,
  densify,
  polylineLength,
  sanitizeWord,
  simplify,
  toGpx,
  type LatLng,
} from '@/lib/wordrun'

type Leaflet = typeof import('leaflet')
type Units = 'km' | 'mi'

/** OSRM refuses very long waypoint lists; thin the route until it fits. */
const MAX_WAYPOINTS = 180
const HOME = CITIES[0]
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
/** Kept in step with `--route` in globals.css; Leaflet needs a literal, not a var(). */
const ROUTE_COLOUR = '#000000'
/**
 * Douglas-Peucker tolerance for the drawn route, in metres, chosen off a sweep
 * against real OSRM output: it sheds ~81% of the vertices, and raising it to 12
 * only reaches 85% while doubling how far the line strays from the street. At
 * the zoom where a whole word is legible this is under a pixel, so the drawn
 * path still tracks the roads.
 *
 * Applied to the drawing only. It shortens the path by ~3%, which would be
 * wrong in an exported GPX.
 */
const SIMPLIFY_M = 6

/** Leaflet is UMD-only and touches `window` at import time, so it loads in the browser. */
async function loadLeaflet(): Promise<Leaflet> {
  const mod = (await import('leaflet')) as unknown as Leaflet & { default?: Leaflet }
  return mod.default ?? mod
}

function formatPace(pace: number): string {
  return `${Math.floor(pace)}:${pace % 1 ? '30' : '00'}`
}

/**
 * Splits an answer around its `email`, if it declares one, so the address is a
 * mailto link on screen while `faq.answer` stays the plain string the JSON-LD
 * needs. Falls back to the raw text if the address is not found, so a typo in
 * one field can never blank the answer.
 */
function renderAnswer(faq: Faq): React.ReactNode {
  if (!faq.email) return faq.answer
  const [before, ...rest] = faq.answer.split(faq.email)
  if (!rest.length) return faq.answer
  return (
    <>
      {before}
      <a href={`mailto:${faq.email}`}>{faq.email}</a>
      {rest.join(faq.email)}
    </>
  )
}

/**
 * The folded-map brand mark, inlined rather than pointed at the copy in
 * public/. That keeps it on `currentColor`, so it tracks the panel's --ink if
 * the surface is ever re-skinned, and avoids referencing a file named
 * favicon-light.svg for the *dark* mark. The source SVG's clipPath is dropped:
 * it clips to the full viewBox, so it was a no-op.
 *
 * aria-hidden because the word "Wordrun" sits immediately beside it; announcing
 * both would just repeat the brand name.
 */
function BrandMark() {
  return (
    <svg
      className={styles.brandMark}
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d="M256 256H0V222.4L39.9121 204.771L95.5742 229.399V229.403L101.25 231.909L104.077 233.158L106.904 231.909L112.581 229.403L112.582 229.402L176.818 201.023L180.989 199.181V194.621L181 46.001L181.001 35.2549L171.172 39.5967L104.087 69.2285L48.4209 44.5986L48.415 44.5967L42.7393 42.0908L39.9121 40.8418L37.085 42.0908L31.4082 44.5967L31.4072 44.5977L0 58.4727V0H256V256ZM155.638 182.658L116.762 199.807V91.3477L155.638 74.1992V182.658ZM91.3984 91.3457V199.802L52.5771 182.66V74.2041L91.3984 91.3457ZM27.2168 182.658L0 194.663V86.2041L27.2168 74.1992V182.658Z" />
    </svg>
  )
}

export default function Wordrun() {
  const [word, setWord] = useState('RUN')
  const [size, setSize] = useState(650)
  const [detail, setDetail] = useState(90)
  const [address, setAddress] = useState('')
  const [start, setStart] = useState<LatLng | null>(null)
  const [startName, setStartName] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<LatLng[] | null>(null)
  const [ideal, setIdeal] = useState<LatLng[][] | null>(null)
  const [distance, setDistance] = useState(0)
  const [units, setUnits] = useState<Units>('km')
  const [pace, setPace] = useState(6)
  const [mapReady, setMapReady] = useState(false)
  const [runToken, setRunToken] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)
  const leafletRef = useRef<Leaflet | null>(null)
  const pickingRef = useRef(false)
  const fittedRef = useRef<LatLng[] | null>(null)
  const boundsRef = useRef<LatLngBoundsLiteral | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  pickingRef.current = picking

  const run = useCallback(() => setRunToken((t) => t + 1), [])

  const generate = useCallback(async () => {
    const cleanWord = sanitizeWord(word) || 'RUN'
    const origin: LatLng = start ?? [HOME.lat, HOME.lon]
    const strokes = buildIdeal(cleanWord, origin, size)
    if (!strokes.length) {
      setError('Type at least one letter.')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    let spacing = detail
    let waypoints = densify(strokes, spacing)
    while (waypoints.length > MAX_WAYPOINTS) {
      spacing *= 1.3
      waypoints = densify(strokes, spacing)
    }

    try {
      const { coords, distance: routed } = await snapToStreets(waypoints, controller.signal)
      // Stored at full resolution. Thinning happens at draw time, so the GPX
      // export keeps every turn of the real street path.
      setRoute(coords)
      setIdeal(strokes)
      setDistance(routed)
    } catch {
      if (controller.signal.aborted) return
      setRoute(waypoints)
      setIdeal(strokes)
      setDistance(polylineLength(waypoints))
      setError('Street routing unavailable right now — showing the ideal line instead.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [word, size, detail, start])

  // Keep a stable handle so the map click listener and `run()` always call the
  // latest closure without re-creating the map.
  const generateRef = useRef(generate)
  useEffect(() => {
    generateRef.current = generate
  })

  useEffect(() => {
    if (runToken > 0) void generateRef.current()
  }, [runToken])

  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | undefined
    let map: LeafletMap | undefined

    void (async () => {
      const L = await loadLeaflet()
      const el = containerRef.current
      if (disposed || !el) return

      leafletRef.current = L
      map = L.map(el, {
        zoomControl: true,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView([HOME.lat, HOME.lon], 14)

      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map)
      layerRef.current = L.layerGroup().addTo(map)

      map.on('click', (ev) => {
        if (!pickingRef.current) return
        setStart([ev.latlng.lat, ev.latlng.lng])
        setStartName(null)
        setPicking(false)
        run()
      })

      // Keep the whole word in frame when the sidebar/map split reflows.
      observer = new ResizeObserver(() => {
        map?.invalidateSize()
        if (boundsRef.current) map?.fitBounds(boundsRef.current, { animate: false })
      })
      observer.observe(el)

      mapRef.current = map
      map.invalidateSize()
      setMapReady(true)
    })()

    return () => {
      disposed = true
      observer?.disconnect()
      map?.remove()
      mapRef.current = null
      layerRef.current = null
      setMapReady(false)
    }
  }, [run])

  // Draw the first route as soon as the map exists.
  useEffect(() => {
    if (mapReady) run()
  }, [mapReady, run])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const group = layerRef.current
    if (!L || !map || !group || !route) return

    const coords = route.filter((p) => p && isFinite(p[0]) && isFinite(p[1]))
    if (!coords.length) return
    const strokes = (ideal ?? [])
      .map((s) => s.filter((p) => p && isFinite(p[0]) && isFinite(p[1])))
      .filter((s) => s.length > 1)

    map.invalidateSize()
    group.clearLayers()

    let south = 90
    let north = -90
    let west = 180
    let east = -180
    for (const [lat, lon] of coords) {
      south = Math.min(south, lat)
      north = Math.max(north, lat)
      west = Math.min(west, lon)
      east = Math.max(east, lon)
    }
    const padLat = (north - south) * 0.15 || 0.002
    const padLon = (east - west) * 0.15 || 0.002
    boundsRef.current = [
      [south - padLat, west - padLon],
      [north + padLat, east + padLon],
    ]

    // Only re-frame when the route itself changed, so a redraw triggered by
    // anything else leaves the user's pan and zoom alone.
    if (fittedRef.current !== route) {
      map.fitBounds(boundsRef.current, { animate: false })
      fittedRef.current = route
    }

    // Always drawn — the toggle that used to gate this is gone from the sidebar.
    for (const stroke of strokes) {
      L.polyline(stroke, {
        color: '#000000',
        weight: 2,
        opacity: 0.45,
        dashArray: '6 8',
      }).addTo(group)
    }
    // Thinned for drawing only: OSRM hands back a vertex per kerb curve, which
    // reads as a jagged edge on a shape whose corners should be the letters'.
    L.polyline(simplify(coords, SIMPLIFY_M), {
      color: ROUTE_COLOUR,
      weight: 5,
      opacity: 1,
    }).addTo(group)
    L.circleMarker(coords[0] as LatLngTuple, {
      radius: 8,
      color: '#000000',
      weight: 2,
      fillColor: '#DEFF4D',
      fillOpacity: 1,
    })
      .addTo(group)
      .bindTooltip('Start')
    L.circleMarker(coords[coords.length - 1] as LatLngTuple, {
      radius: 6,
      color: '#000000',
      weight: 2,
      fillColor: '#FFFFFF',
      fillOpacity: 1,
    })
      .addTo(group)
      .bindTooltip('Finish')
  }, [route, ideal, mapReady])

  useEffect(() => () => abortRef.current?.abort(), [])

  const searchAddress = useCallback(async () => {
    const query = address.trim()
    if (!query || geocoding) return
    setGeocoding(true)
    setError(null)
    try {
      const hit = await geocode(query)
      if (!hit) {
        setError('No match for that address — try adding a city or country.')
        return
      }
      setStart(hit.point)
      setStartName(hit.name)
      setPicking(false)
      mapRef.current?.setView(hit.point, 14, { animate: false })
      run()
    } catch {
      setError('Address lookup failed — try again or pick on the map.')
    } finally {
      setGeocoding(false)
    }
  }, [address, geocoding, run])

  const exportGpx = useCallback(() => {
    if (!route) return
    const blob = new Blob([toGpx(word, route)], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wordrun-${(sanitizeWord(word) || 'run').toLowerCase().replace(/\s+/g, '-')}.gpx`
    link.click()
    URL.revokeObjectURL(url)
  }, [route, word])

  const resetStart = useCallback(() => {
    setStart(null)
    setStartName(null)
    setAddress('')
    setPicking(false)
    run()
  }, [run])

  const km = distance / 1000
  const distanceValue = units === 'mi' ? km * 0.621371 : km
  const minutes = Math.round(distanceValue * (units === 'mi' ? pace * 1.60934 : pace))
  const timeText =
    minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div>
          <div className={`${styles.eyebrow} ${styles.brand}`}>
            <BrandMark />
            Wordrun
          </div>
          <h1 className={styles.title}>Run a word onto the map</h1>
          <p className={styles.lede}>
            Type a word, set a start point, and get a continuous street route that draws it.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.eyebrow} htmlFor="word">
            Your word
          </label>
          <input
            id="word"
            className={styles.wordInput}
            value={word}
            onChange={(e) => setWord(sanitizeWord(e.target.value))}
            maxLength={10}
            placeholder="RUN"
            spellCheck={false}
            autoComplete="off"
          />
          <div className={styles.hint}>Letters A–Z, up to 10.</div>
        </div>

        <div className={styles.field}>
          <div className={styles.eyebrow}>Start point</div>
          <div className={styles.row}>
            <input
              className={styles.textInput}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void searchAddress()
              }}
              placeholder="Type an address or place"
              spellCheck={false}
              aria-label="Address or place"
            />
            <button className={styles.buttonPrimary} onClick={() => void searchAddress()}>
              {geocoding ? 'Finding…' : 'Set start'}
            </button>
          </div>
          <div className={styles.hint}>
            {start
              ? `Start: ${startName ?? `${start[0].toFixed(4)}, ${start[1].toFixed(4)}`}`
              : 'Type an address, or pick a point on the map.'}
          </div>
          <div className={styles.row}>
            <button
              className={picking ? styles.buttonPickActive : styles.buttonPick}
              onClick={() => setPicking((p) => !p)}
            >
              {picking
                ? 'Click the map to set your start…'
                : start
                  ? 'Move start point'
                  : 'Pick start on map'}
            </button>
            {start && (
              <button className={styles.buttonGhost} onClick={resetStart}>
                Reset
              </button>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.eyebrow} htmlFor="size">
            Letter height — {size} m
          </label>
          <input
            id="size"
            className={styles.slider}
            type="range"
            min={200}
            max={900}
            step={50}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <div className={styles.hint}>Bigger letters, longer run — and easier to read.</div>
        </div>

        <div className={styles.field}>
          <label className={styles.eyebrow} htmlFor="detail">
            Drawing accuracy
          </label>
          <input
            id="detail"
            className={styles.slider}
            type="range"
            min={60}
            max={190}
            step={10}
            value={250 - detail}
            onChange={(e) => setDetail(250 - Number(e.target.value))}
          />
          <div className={styles.hint}>
            Higher accuracy hugs the letter shapes more closely, with more turns.
          </div>
        </div>

        <button className={styles.buttonLarge} onClick={() => run()} disabled={loading}>
          {loading ? 'Routing…' : 'Generate route'}
        </button>

        {error && <div className={styles.error}>{error}</div>}

        {route && (
          <div className={styles.results}>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={`${styles.eyebrow} ${styles.statLabel}`}>Distance</div>
                <div className={styles.statValue}>
                  {distanceValue.toFixed(1)} {units}
                </div>
              </div>
              <div className={styles.stat}>
                <div className={`${styles.eyebrow} ${styles.statLabel}`}>Est. time</div>
                <div className={styles.statValue}>{timeText}</div>
              </div>
            </div>
            <div className={styles.hint}>
              At {formatPace(pace)} min/km pace, including connector segments between letters.
            </div>
            <button className={styles.buttonOutline} onClick={exportGpx}>
              Export GPX
            </button>
          </div>
        )}

        <div className={styles.field}>
          <div className={styles.eyebrow}>Run settings</div>
          <div className={styles.segmented} role="group" aria-label="Distance units">
            {(['km', 'mi'] as Units[]).map((u) => (
              <button
                key={u}
                className={units === u ? styles.segmentActive : styles.segment}
                onClick={() => setUnits(u)}
                aria-pressed={units === u}
              >
                {u}
              </button>
            ))}
          </div>
          <label className={styles.hint} htmlFor="pace">
            Pace — {formatPace(pace)} min/km
          </label>
          <input
            id="pace"
            className={styles.slider}
            type="range"
            min={4}
            max={9}
            step={0.5}
            value={pace}
            onChange={(e) => setPace(Number(e.target.value))}
          />
        </div>

        {/* Collapsed by default so the controls stay the focus, but present in
            the server-rendered HTML — this is the page's indexable prose and
            the visible half of the FAQPage structured data in page.tsx. */}
        <section className={styles.about} aria-labelledby="about-heading">
          <h2 id="about-heading" className={styles.aboutHeading}>
            About Wordrun
          </h2>
          {FAQS.map((faq) => (
            <details key={faq.question} className={styles.faq}>
              <summary className={styles.faqQuestion}>{faq.question}</summary>
              <p className={styles.faqAnswer}>{renderAnswer(faq)}</p>
            </details>
          ))}
        </section>
      </aside>

      <div className={styles.mapWrap}>
        <div
          ref={containerRef}
          className={styles.map}
          role="region"
          aria-label="Map showing your word drawn as a street route"
        />
        {loading && <div className={styles.toast}>Snapping to streets…</div>}
      </div>
    </main>
  )
}
