import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Combined OBS Overlay',
  description: 'OBS Combined Overlay',
}

export const viewport: Viewport = {
  width: 1920,
  height: 1080,
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
}

export default function CombinedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ width: '100%', height: '100%', margin: 0, padding: 0, overflow: 'hidden' }}>
      {children}
    </div>
  )
}