import { YoutubeTranscript } from 'youtube-transcript'
import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/youtube'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || ''
  const videoId = extractVideoId(url)

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    const text = transcript.map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim()

    if (!text || text.length < 100) {
      return NextResponse.json(
        { error: 'No transcript found. This video may not have captions enabled.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      transcript: text,
      wordCount: text.split(/\s+/).length,
      videoId,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch transcript'
    const isNoCaptions =
      message.includes('disabled') ||
      message.includes('No transcript') ||
      message.includes('Could not get')

    return NextResponse.json(
      {
        error: isNoCaptions
          ? 'This video has no captions. Try a video with CC (subtitles) enabled.'
          : 'Failed to fetch transcript. The video may be private or age-restricted.',
      },
      { status: 500 }
    )
  }
}
