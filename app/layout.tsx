import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'TubeDigest — AI YouTube Summarizer',
  description: 'Paste a YouTube link and get an instant AI summary, key quotes, and a quiz.',
  openGraph: {
    title: 'TubeDigest',
    description: 'Instant AI summaries for any YouTube video.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${dmMono.variable}`}>{children}</body>
    </html>
  )
}
