# Wordrun

Type a word, set a start point, and get a continuous street route that draws it. Export the result as GPX.

Built with Next.js (App Router) and Leaflet. Routes are snapped to walkable streets with
[OSRM](https://routing.openstreetmap.de/), place search uses
[Nominatim](https://nominatim.openstreetmap.org/), and tiles come from OpenStreetMap.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```

## Deploying to Vercel

The app is a static-rendered Next.js page with no environment variables, secrets, or server
routes, so it deploys with zero configuration.

```bash
npx vercel        # preview deployment
npx vercel --prod # production deployment
```

Or push the repo to GitHub/GitLab/Bitbucket and import it at
[vercel.com/new](https://vercel.com/new) — Vercel auto-detects Next.js and needs no build
settings changes.

## How it works

| File | Role |
| --- | --- |
| [app/page.tsx](app/page.tsx) | Server component; renders the app |
| [app/wordrun.tsx](app/wordrun.tsx) | Client component: UI, map lifecycle, route generation |
| [app/wordrun.module.css](app/wordrun.module.css) | Component styles, including the mobile stacked layout |
| [app/layout.tsx](app/layout.tsx) | Document shell, metadata, self-hosted Slalom Sans via `next/font/local` |
| [lib/wordrun.ts](lib/wordrun.ts) | Single-stroke alphabet, glyph layout, densification, GPX serialisation |
| [lib/osm.ts](lib/osm.ts) | OSRM foot-routing and Nominatim geocoding clients |

Generating a route:

1. Each letter is laid out as polylines on a 4 x 6 grid and projected to lat/lon at the chosen
   letter height ([`buildIdeal`](lib/wordrun.ts)).
2. Those strokes are sampled into waypoints at the chosen accuracy spacing
   ([`densify`](lib/wordrun.ts)). If the list exceeds 180 points the spacing widens until it fits
   what OSRM will accept in one request.
3. OSRM snaps the waypoints to a continuous walking route. If it is unavailable, the app falls
   back to drawing the ideal line and reports the straight-line distance.

Leaflet is a UMD-only bundle that touches `window` at import time, so it is loaded with a dynamic
`import()` inside an effect rather than at module scope.

## Notes

- `fonts/` holds the Slalom Sans OTFs consumed by `next/font/local`. They are not in `public/`
  because `next/font` fingerprints and serves them itself.
- OSRM and Nominatim are free community endpoints with rate limits and no uptime guarantee. For
  anything beyond casual traffic, self-host them or move the calls into a Next.js route handler
  where they can be cached.
- [legacy/](legacy/) keeps the original single-file Design Component (`Wordrun.dc.html` plus its
  `support.js` runtime) that this app was converted from. Nothing in the app imports it.
