import type { LatLng } from './wordrun'

const OSRM_FOOT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/'
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'

type OsrmResponse = {
  code: string
  message?: string
  routes?: { distance: number; geometry: { coordinates: [number, number][] } }[]
}

/** Snap a waypoint list to walkable streets. Returns the followed path in [lat, lon]. */
export async function snapToStreets(
  waypoints: LatLng[],
  signal?: AbortSignal,
): Promise<{ coords: LatLng[]; distance: number }> {
  const locs = waypoints.map((p) => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join(';')
  const url = `${OSRM_FOOT}${locs}?overview=full&geometries=geojson&continue_straight=false`
  const res = await fetch(url, { signal })
  const data: OsrmResponse = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(data.message || data.code)
  const route = data.routes[0]
  return {
    coords: route.geometry.coordinates.map(([lon, lat]): LatLng => [lat, lon]),
    distance: route.distance,
  }
}

type NominatimHit = { lat: string; lon: string; display_name: string }

/** Free-text place lookup. Returns null when there is no match. */
export async function geocode(
  query: string,
  signal?: AbortSignal,
): Promise<{ point: LatLng; name: string } | null> {
  const url = `${NOMINATIM_SEARCH}?format=json&limit=1&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal })
  const data: NominatimHit[] = await res.json()
  if (!data.length) return null
  const hit = data[0]
  return {
    point: [Number(hit.lat), Number(hit.lon)],
    name: hit.display_name.split(',').slice(0, 2).join(','),
  }
}
