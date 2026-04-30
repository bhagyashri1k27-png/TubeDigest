export function extractVideoId(url: string): string | null {
  url = url.trim()
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url
  return null
}

export type SummaryMode = 'bullets' | 'detailed' | 'eli5' | 'tldr'

export interface SummaryResult {
  tldr: string
  bullet_points: string[]
  notable_quotes: string[]
  quiz: {
    question: string
    options: string[]
    answer: number
  }[]
}
