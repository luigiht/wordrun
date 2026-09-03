import Wordrun from './wordrun'
import { FAQS } from '@/lib/faq'
import {
  ORG_NAME,
  SITE_DESCRIPTION,
  SITE_FEATURES,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from '@/lib/site'

/**
 * One `@graph` rather than several scripts, so the nodes can reference each
 * other by `@id` and search engines resolve the site, the publisher and the
 * app as one entity instead of three unrelated ones.
 */
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: ORG_NAME,
      url: SITE_URL,
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#webapp`,
      name: SITE_NAME,
      alternateName: `${SITE_NAME} — ${SITE_TAGLINE}`,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: 'HealthApplication',
      applicationSubCategory: 'Running route planner',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript.',
      isAccessibleForFree: true,
      // Schema.org needs an explicit zero-price Offer to mark something free.
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      featureList: SITE_FEATURES,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, author-controlled copy — no user input reaches this string.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Wordrun />
    </>
  )
}
