/**
 * Single source of truth for anything that ends up in a `<meta>` tag, the
 * sitemap, robots.txt, the web manifest or the JSON-LD graph. Keeping it here
 * stops the canonical URL, the OG title and the structured data from drifting
 * apart as the copy changes.
 */

/**
 * Canonical origin used to build the absolute URLs that crawlers require.
 *
 * Resolution order:
 *  1. `NEXT_PUBLIC_SITE_URL` — set this once a custom domain is attached.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel injects the *production* domain
 *     into every environment at build time, so preview builds still emit
 *     canonicals that point at production instead of self-canonicalising a
 *     throwaway deployment URL.
 *  3. localhost, for `next dev`.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (production) return `https://${production}`

  return 'http://localhost:3000'
}

export const SITE_URL = resolveSiteUrl()

export const SITE_NAME = 'Wordrun'
export const SITE_TAGLINE = 'Run a word onto the map'
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`

/** ~155 characters, so Google is unlikely to truncate it in a result snippet. */
export const SITE_DESCRIPTION =
  'Type a word, drop a start pin anywhere in the world, and get a continuous street route that spells it out. Check distance and pace, then export a GPX file.'

/** Shorter variant for cards, where the platform crops harder than search does. */
export const SITE_SUMMARY =
  'Type a word, drop a start pin, and get a continuous street route that spells it out. Export it as GPX.'

export const ORG_NAME = 'Slalom'

export const SITE_KEYWORDS = [
  'wordrun',
  'run a word',
  'running route planner',
  'draw with GPS',
  'GPS art',
  'strava art',
  'gpx route generator',
  'running route generator',
  'openstreetmap running route',
  'word route map',
]

export const SITE_FEATURES = [
  'Spell any word up to ten letters as a running route',
  'Snap the route to real walkable streets via OpenStreetMap',
  'Set the start point by address search or by clicking the map',
  'Adjust letter height and drawing accuracy',
  'Distance and estimated finish time in kilometres or miles',
  'Export the route as a GPX file',
]
