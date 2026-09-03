import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/**
 * Served at /sitemap.xml. `lastModified` is stamped at build time, so a
 * redeploy is what tells crawlers the page changed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      // No trailing slash, so this matches the <link rel="canonical"> exactly.
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
