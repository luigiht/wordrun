/**
 * Rendered in the sidebar *and* emitted as `FAQPage` JSON-LD from
 * [app/page.tsx](../app/page.tsx). Google only credits structured data that a
 * visitor can actually read, so both must come from this one list.
 *
 * Kept separate from [site.ts](./site.ts) because the sidebar is a client
 * component: importing the site config there would pull `process.env` reads
 * that only resolve on the server into the browser bundle.
 */
export type Faq = { question: string; answer: string }

export const FAQS: Faq[] = [
  {
    question: 'How does Wordrun turn a word into a running route?',
    answer:
      'Each letter is drawn as a single continuous stroke on a grid, projected onto the map at the letter height you choose, then sampled into waypoints. An OpenStreetMap routing engine snaps those waypoints to real walkable streets, so the finished line follows roads and pavements instead of cutting through buildings.',
  },
  {
    question: 'Can I follow the route on my running watch?',
    answer:
      'Yes. Export GPX writes a standard GPS track that imports into Garmin Connect, Strava, Komoot, Suunto, Coros and anything else that reads GPX, so you can follow the word turn by turn on your watch.',
  },
  {
    question: 'Which letters can I use, and how many?',
    answer:
      'Letters A to Z and spaces, up to ten characters. Every letter is drawn in a single-stroke alphabet designed so the pen lifts as little as possible, which keeps the route continuous and readable once it is snapped to streets.',
  },
  {
    question: 'How long will the run be?',
    answer:
      'It depends on word length and the letter height you pick, which ranges from 200 to 900 metres. Wordrun shows the routed distance in kilometres or miles alongside an estimated finish time based on your pace, including the connector segments between letters.',
  },
  {
    question: 'Does the route always follow real streets?',
    answer:
      'Almost always. Waypoints are snapped to the walkable street network, so the shape of a letter depends on the streets that exist around your start point. Grid layouts read cleanly; cul-de-sacs and rivers distort the letters. If the routing service is unavailable, Wordrun draws the ideal letter shape instead and says so.',
  },
  {
    question: 'Is Wordrun free?',
    answer:
      'Yes. Wordrun is free, needs no account, and runs entirely in your browser on open data from OpenStreetMap.',
  },
]
