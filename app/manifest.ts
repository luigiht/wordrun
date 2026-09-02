import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wordrun — run a word onto the map',
    short_name: 'Wordrun',
    description:
      'Type a word, set a start point, and get a continuous street route that draws it. Export as GPX.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e3a48',
    icons: [
      // No `maskable` purpose: the wordmark bleeds to the edges, so Android's
      // safe-zone crop would clip the leading W and trailing N.
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
