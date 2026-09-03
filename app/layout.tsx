import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import {
  ORG_NAME,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_SUMMARY,
  SITE_TITLE,
  SITE_URL,
} from '@/lib/site'

// Variable font, so no `weight` list is needed. Manrope's wght axis is 200-800,
// which covers the 300/400/700/800 the UI uses. Named --font-sans rather than
// --font-manrope so swapping the family again stays a one-line change here.
const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
})

export const metadata: Metadata = {
  // Makes every relative URL below (canonical, OG, card images) resolve to an
  // absolute one. Without it Next.js emits relative OG tags, which crawlers
  // and social scrapers ignore.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: ORG_NAME }],
  creator: ORG_NAME,
  publisher: ORG_NAME,
  category: 'sports',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Allow a full-size image and an untruncated snippet in results.
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'en_GB',
    // Image comes from app/opengraph-image.tsx.
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_SUMMARY,
    // Image comes from app/twitter-image.tsx.
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'default',
  },
  // Stops iOS Safari turning coordinates and distances into tel: links.
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The brand primary, matching the favicons and social card, rather than the
  // white panel it sits above.
  themeColor: '#121212',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <head>
        {/* Hand-written rather than via `metadata.icons`, which cannot express a
            media query. Dark ink on light chrome and vice versa; app/favicon.ico
            stays as the fallback for clients that ignore SVG icons. */}
        <link
          rel="icon"
          href="/favicon-light.svg"
          type="image/svg+xml"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="icon"
          href="/favicon-dark.svg"
          type="image/svg+xml"
          media="(prefers-color-scheme: dark)"
        />

        {/* Warm up the third-party origins the map hits on first paint. */}
        <link rel="preconnect" href="https://tile.openstreetmap.org" crossOrigin="" />
        <link rel="dns-prefetch" href="https://routing.openstreetmap.de" />
        <link rel="dns-prefetch" href="https://nominatim.openstreetmap.org" />
      </head>
      <body>{children}</body>
    </html>
  )
}
