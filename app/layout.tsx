import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'BasarIQ — Israel Beef Price Intelligence',
  description: 'Community-driven beef price tracker for Israeli vendors',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  )
}
