import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { useEffect } from 'react'
import { OfflineBanner } from '../components/pwa/OfflineBanner.js'
import { registerServiceWorker } from '../lib/pwa.js'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: 'RoomBook — Meeting Room Booking',
      },
      {
        name: 'description',
        content: 'Book meeting and conference rooms across office locations.',
      },
      { name: 'theme-color', content: '#008037' },
      { name: 'application-name', content: 'RoomBook' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'RoomBook' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'format-detection', content: 'telephone=no' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icons/icon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png', sizes: '180x180' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <OfflineBanner />
        {children}
        <Scripts />
      </body>
    </html>
  )
}
