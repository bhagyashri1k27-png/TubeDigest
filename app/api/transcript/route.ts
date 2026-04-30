import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/youtube'

const CLIENTS = [
  {
    clientName: 'ANDROID',
    clientVersion: '19.09.37',
    androidSdkVersion: 30,
  },
  {
    clientName: 'WEB',
    clientVersion: '2.20210721.00.00',
  },
  {
    clientName: 'IOS',
    clientVersion: '19.09.3',
  },
]

async function fetchCaptionTracks(videoId: string) {
  for (const client of CLIENTS) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': client.clientVersion,
        },
        body: JSON.stringify({
          context: { client },
          videoId,
        }),
      })

      if (!res.ok) continue

      const data = await res.json()
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks

      if (tracks && tracks.length > 0) {
        const title: string = data?.videoDetails?.title || `Video ${videoId}`
        return { tracks, title }
      }
    } catch {
      continue
    }
  }
  throw new Error('No captions found. Try a video that has CC subtitles enabled.')
}

async function fetchTranscript(videoId: string) {
  const { tracks, title } = await fetchCaptionTracks(videoId)

  // Prefer: English manual > English auto-generated > any manual > any
  const pick =
    tracks.find((t: any) => t.languageCode?.startsWith('en') && !t.kind) ||
    tracks.find((t: any) => t.languageCode?.startsWith('en')) ||
    tracks.find((t: any) => !t.kind) ||
    tracks[0]

  const captionRes = await fetch(pick.baseUrl + '&fmt=json3', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!captionRes.ok) throw new Error('Failed to download captions')

  const captionData = await captionRes.json()

  const transcript: string = (captionData.events || [])
    .filter((e: any) => e.segs)
    .flatMap((e: any) => e.segs.map((s: any) => s.utf8 as string))
    .join(' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!transcript || transcript.length < 50) throw new Error('Transcript too short or empty.')

  return { transcript, title }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || ''
  const videoId = extractVideoId(url)

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
  }

  try {
    const { transcript, title } = await fetchTranscript(videoId)
    const wordCount = transcript.split(/\s+/).length
    return NextResponse.json({ transcript, title, videoId, wordCount })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch transcript'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}