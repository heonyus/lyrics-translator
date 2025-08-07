'use client'

import type { ReactNode } from 'react'
import './mobile-live.css'

export default function MobileLiveLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="mobile-live-container">
      {children}
    </div>
  )
}