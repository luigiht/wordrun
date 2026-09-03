import type { MetadataRoute } from 'next'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from '@/lib/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Stable `id` so an installed copy survives a change of start_url.
    id: '/',
    name: SITE_TITLE,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'en',
    dir: 'ltr',
    categories: ['health', 'fitness', 'sports', 'navigation'],
    // Light splash to match the app; dark chrome from the brand primary.
    background_color: '#ffffff',
    theme_color: '#121212',
    icons: [
      // No `maskable` purpose: the wordmark bleeds to the edges, so Android's
      // safe-zone crop would clip the leading W and trailing N.
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
