import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/youtube'

const CLIENTS = [
  {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': '19.09.37',
    },
    context: {
      client: { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30, hl: 'en', gl: 'US' },
    },
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (TV; rv:109.0) Gecko/109.0 Firefox/109.0',
      'X-YouTube-Client-Name': '7',
      'X-YouTube-Client-Version': '7.20210224.00.00',
    },
    context: {
      client: { clientName: 'TVHTML5', clientVersion: '7.20210224.00.00', hl: 'en', gl: 'US' },
    },
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': '2.20210721.00.00',
    },
    context: {
      client: { clientName: 'WEB', clientVersion: '2.20210721.00.00', hl: 'en', gl: 'US' },
    },
  },
]

async function getTracksViaInnertube(videoId: string) {
  for (const client of CLIENTS) {
    try {
      const res = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false`,
        {
          method: 'POST',
          headers: client.headers,
          body: JSON.stringify({ context: client.context, videoId }),
        }
      )
      if (!res.ok) continue
      const data = await res.json()
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      const title: string = data?.videoDetails?.title || ''
      if (tracks?.length) return { tracks, title }
    } catch { continue }
  }
  return null
}

async function getTracksViaTimedtext(videoId: string) {
  try {
    const listRes = await fetch(
      `https://video.google.com/timedtext?v=${videoId}&type=list`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!listRes.ok) return null
    const xml = await listRes.text()
    const langs = [...xml.matchAll(/lang_code="([^"]+)"/g)].map((m) => m[1])
    if (!langs.length) return null
    const lang = langs.find((l) => l.startsWith('en')) || langs[0]
    return { lang }
  } catch { return null }
}

async function fetchTranscript(videoId: string) {
  let captionUrl = ''
  let title = ''

  const innertube = await getTracksViaInnertube(videoId)

  if (innertube?.tracks?.length) {
    title = innertube.title
    const pick =
      innertube.tracks.find((t: any) => t.languageCode?.startsWith('en') && !t.kind) ||
      innertube.tracks.find((t: any) => t.languageCode?.startsWith('en')) ||
      innertube.tracks.find((t: any) => !t.kind) ||
      innertube.tracks[0]
    captionUrl = pick.baseUrl + '&fmt=json3'
  } else {
    const timedtext = await getTracksViaTimedtext(videoId)
    if (!timedtext) {
      throw new Error(
        'No captions found. Make sure the video has CC subtitles enabled on YouTube.'
      )
    }
    captionUrl = `https://video.google.com/timedtext?v=${videoId}&lang=${timedtext.lang}&fmt=json3`
  }

  const captionRes = await fetch(captionUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!captionRes.ok) throw new Error('Failed to download captions.')

  const captionData = await captionRes.json()

  const transcript: string = (captionData.events || [])
    .filter((e: any) => e.segs)
    .flatMap((e: any) => e.segs.map((s: any) => s.utf8 as string))
    .join(' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!transcript || transcript.length < 50)
    throw new Error('Transcript is empty or too short.')

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
