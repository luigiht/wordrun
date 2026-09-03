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

## SEO

Everything crawlers read is derived from [lib/site.ts](lib/site.ts), so the canonical URL, the
Open Graph tags, the sitemap and the JSON-LD cannot drift apart.

The one thing worth setting is the canonical origin, which is resolved in this order:

1. `NEXT_PUBLIC_SITE_URL` — set this in the Vercel project once a custom domain is attached.
2. `VERCEL_PROJECT_PRODUCTION_URL` — injected by Vercel into every environment, so preview
   builds canonicalise to production rather than to a throwaway deployment URL.
3. `http://localhost:3000`, for `next dev`.

Two gotchas, both verified against a production build:

- **The variable has to be present at runtime, not just at build.** `next start` re-resolves
  metadata per request, so a build that baked the right origin still serves `localhost`
  canonicals if the serving process lacks the variable. Vercel exposes project variables to both
  phases, so this only bites self-hosted deployments. Emitting `localhost` canonicals stops the
  page being indexed at all.
- A cached `.next` can serve a stale origin after the variable changes; `rm -rf .next` before
  rebuilding.

What ships:

- `/robots.txt` and `/sitemap.xml` from [app/robots.ts](app/robots.ts) and
  [app/sitemap.ts](app/sitemap.ts).
- Canonical link, Open Graph and `summary_large_image` Twitter tags, and `max-image-preview:large`
  so results can carry a full-size thumbnail.
- A `WebSite` + `Organization` + `WebApplication` + `FAQPage` JSON-LD graph, wired by `@id`.
- The 1200x630 card at [app/opengraph-image.png](app/opengraph-image.png). Next.js fills in
  `og:image` and `twitter:image` from that one file, with the alt text taken from
  `app/opengraph-image.alt.txt`.
- Colour-scheme-aware SVG favicons from `public/`, declared in
  [app/layout.tsx](app/layout.tsx) because `metadata.icons` cannot express a `media` query.
  `app/favicon.ico` remains the fallback for clients that ignore SVG icons.
- The FAQ prose in [lib/faq.ts](lib/faq.ts), server-rendered into the sidebar. Google only
  credits structured data a visitor can actually read, so the copy and the `FAQPage` markup are
  generated from that one list.

Both the sidebar and the map are server-rendered, so the headline, controls and FAQ are in the
initial HTML; only the Leaflet tiles need JavaScript.

## How it works

| File | Role |
| --- | --- |
| [app/page.tsx](app/page.tsx) | Server component; renders the app and the JSON-LD graph |
| [app/wordrun.tsx](app/wordrun.tsx) | Client component: UI, map lifecycle, route generation |
| [app/wordrun.module.css](app/wordrun.module.css) | Component styles, including the mobile stacked layout |
| [app/layout.tsx](app/layout.tsx) | Document shell, metadata, Inter + Manrope via `next/font/google` |
| [app/opengraph-image.png](app/opengraph-image.png) | 1200x630 social card, reused for the Twitter card |
| [app/robots.ts](app/robots.ts) / [app/sitemap.ts](app/sitemap.ts) | `/robots.txt` and `/sitemap.xml` |
| [lib/site.ts](lib/site.ts) | Canonical URL and the shared metadata copy |
| [lib/faq.ts](lib/faq.ts) | FAQ copy, rendered in the sidebar and as `FAQPage` structured data |
| [lib/wordrun.ts](lib/wordrun.ts) | Single-stroke alphabet, glyph layout, densification, simplification, GPX serialisation |
| [lib/osm.ts](lib/osm.ts) | OSRM foot-routing and Nominatim geocoding clients |

Generating a route:

1. Each letter is laid out as polylines on a 4 x 6 grid and projected to lat/lon at the chosen
   letter height ([`buildIdeal`](lib/wordrun.ts)).
2. Those strokes are sampled into waypoints at the chosen accuracy spacing
   ([`densify`](lib/wordrun.ts)). If the list exceeds 180 points the spacing widens until it fits
   what OSRM will accept in one request.
3. OSRM snaps the waypoints to a continuous walking route. If it is unavailable, the app falls
   back to drawing the ideal line and reports the straight-line distance.
4. The route is thinned with Douglas-Peucker ([`simplify`](lib/wordrun.ts)) **for drawing only**.
   OSRM returns a vertex per kerb curve, which reads as noise on a shape whose corners should be
   the letters'; at the 6 m tolerance in `SIMPLIFY_M` that removes ~80% of the vertices while
   staying under a pixel at the zoom where a word is legible.

The stored route stays at full resolution, so the GPX export keeps every turn of the real street
path and the reported distance is OSRM's own figure rather than the drawn approximation.

Leaflet is a UMD-only bundle that touches `window` at import time, so it is loaded with a dynamic
`import()` inside an effect rather than at module scope.

## Notes

- `assets/` holds the source brand artwork. `opengraph.png` and the two `favicon-*.svg` files
  are copied into `app/` and `public/` as the served versions, so edit the originals here and
  re-copy rather than editing the copies.
- `fonts/` holds the Slalom Sans OTFs, but nothing currently imports them — type is Inter for body
  copy and Manrope for display, both via `next/font/google`
  ([app/layout.tsx](app/layout.tsx)). Keep them if Slalom Sans is coming back; otherwise they are
  dead weight.
- Manrope's weight axis stops at 800, where Inter's runs to 900. The two display rules that used
  900 are now 800; anything heavier will silently clamp.
- OSRM and Nominatim are free community endpoints with rate limits and no uptime guarantee. For
  anything beyond casual traffic, self-host them or move the calls into a Next.js route handler
  where they can be cached.
- [legacy/](legacy/) keeps the original single-file Design Component (`Wordrun.dc.html` plus its
  `support.js` runtime) that this app was converted from. Nothing in the app imports it.
