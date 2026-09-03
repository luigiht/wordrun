import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/** Served at /robots.txt. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Next.js build artefacts hold no indexable content and only waste
        // crawl budget if a stray link ever exposes them.
        disallow: ['/_next/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
