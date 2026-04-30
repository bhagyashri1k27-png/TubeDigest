import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/youtube'

async function fetchTranscript(videoId: string) {
  const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': '2.20210721.00.00',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20210721.00.00',
          hl: 'en',
          gl: 'US',
        },
      },
      videoId,
    }),
  })

  if (!playerRes.ok) throw new Error(`YouTube returned ${playerRes.status}`)

  const playerData = await playerRes.json()
  const title: string = playerData?.videoDetails?.title || `Video ${videoId}`
  const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('No captions found. This video may not have subtitles enabled.')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const track = captionTracks.find((t: any) => t.languageCode?.startsWith('en')) || captionTracks[0]
  const captionUrl: string = track.baseUrl + '&fmt=json3'

  const captionRes = await fetch(captionUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  })
  if (!captionRes.ok) throw new Error('Failed to download captions')

  const captionData = await captionRes.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transcript: string = (captionData.events || [])
    .filter((e: any) => e.segs)
    .flatMap((e: any) => e.segs.map((s: any) => s.utf8 as string))
    .join(' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!transcript || transcript.length < 50) throw new Error('Transcript is empty or too short.')

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