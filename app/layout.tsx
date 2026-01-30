import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bain Output Readiness Classifier',
  description: 'Validate AI-generated case deliverables for readiness',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}

