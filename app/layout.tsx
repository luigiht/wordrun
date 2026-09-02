import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const slalomSans = localFont({
  src: [
    { path: '../fonts/SlalomSans-Light.otf', weight: '300', style: 'normal' },
    { path: '../fonts/SlalomSans-Regular.otf', weight: '400', style: 'normal' },
    { path: '../fonts/SlalomSans-Bold.otf', weight: '700', style: 'normal' },
    { path: '../fonts/SlalomSans-Black.otf', weight: '900', style: 'normal' },
  ],
  variable: '--font-slalom-sans',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Wordrun — run a word onto the map',
  description:
    'Type a word, set a start point, and get a continuous street route that draws it. Export as GPX.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c62fb',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={slalomSans.variable}>
      <body>{children}</body>
    </html>
  )
}
