'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLngBoundsLiteral, LatLngTuple, LayerGroup, Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './wordrun.module.css'
import { geocode, snapToStreets } from '@/lib/osm'
import {
  CITIES,
  buildIdeal,
  densify,
  polylineLength,
  sanitizeWord,
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

/** Leaflet is UMD-only and touches `window` at import time, so it loads in the browser. */
async function loadLeaflet(): Promise<Leaflet> {
  const mod = (await import('leaflet')) as unknown as Leaflet & { default?: Leaflet }
  return mod.default ?? mod
}

function formatPace(pace: number): string {
  return `${Math.floor(pace)}:${pace % 1 ? '30' : '00'}`
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
  const [showIdeal, setShowIdeal] = useState(true)
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

    // Only re-frame when the route itself changed, so toggling overlays is calm.
    if (fittedRef.current !== route) {
      map.fitBounds(boundsRef.current, { animate: false })
      fittedRef.current = route
    }

    if (showIdeal) {
      for (const stroke of strokes) {
        L.polyline(stroke, {
          color: '#000000',
          weight: 2,
          opacity: 0.45,
          dashArray: '6 8',
        }).addTo(group)
      }
    }
    L.polyline(coords, { color: '#0C62FB', weight: 5, opacity: 0.95 }).addTo(group)
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
  }, [route, ideal, showIdeal, mapReady])

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
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div>
          <div className={`${styles.eyebrow} ${styles.brand}`}>Wordrun</div>
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
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={showIdeal}
              onChange={(e) => setShowIdeal(e.target.checked)}
            />
            Show the ideal letter shape
          </label>
        </div>

        <div className={styles.footnote}>
          Routes snap to real streets via OpenStreetMap. Solid blue is your run; the dashed line is
          the ideal letter shape.
        </div>
      </aside>

      <div className={styles.mapWrap}>
        <div ref={containerRef} className={styles.map} />
        {loading && <div className={styles.toast}>Snapping to streets…</div>}
      </div>
    </div>
  )
}
