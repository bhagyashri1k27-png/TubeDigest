'use client'

import { useState, useRef } from 'react'
import { extractVideoId, type SummaryMode, type SummaryResult } from '@/lib/youtube'
import styles from './page.module.css'

type Status = 'idle' | 'fetching' | 'summarizing' | 'done' | 'error'

const MODES: { id: SummaryMode; label: string }[] = [
  { id: 'bullets',  label: 'bullet points' },
  { id: 'detailed', label: 'detailed' },
  { id: 'eli5',     label: 'ELI5' },
  { id: 'tldr',     label: 'TL;DR only' },
]

// Runs in the BROWSER - YouTube does not block real browser requests
async function fetchYouTubeTranscript(videoId: string) {
  const clients = [
    { clientName: 'WEB', clientVersion: '2.20210721.00.00' },
    { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30 },
    { clientName: 'TVHTML5', clientVersion: '7.20210224.00.00' },
  ]

  for (const clientConfig of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { ...clientConfig, hl: 'en', gl: 'US' } },
          videoId,
        }),
      })
      if (!res.ok) continue

      const data = await res.json()
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      const title: string = data?.videoDetails?.title || `Video ${videoId}`

      if (!tracks?.length) continue

      const track =
        tracks.find((t: any) => t.languageCode?.startsWith('en') && !t.kind) ||
        tracks.find((t: any) => t.languageCode?.startsWith('en')) ||
        tracks.find((t: any) => !t.kind) ||
        tracks[0]

      const captionRes = await fetch(track.baseUrl + '&fmt=json3')
      if (!captionRes.ok) continue

      const captionData = await captionRes.json()
      const transcript: string = (captionData.events || [])
        .filter((e: any) => e.segs)
        .flatMap((e: any) => e.segs.map((s: any) => s.utf8 as string))
        .join(' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (transcript.length > 50) {
        return { transcript, title, wordCount: transcript.split(/\s+/).length }
      }
    } catch { continue }
  }

  throw new Error('No captions found. Try a video with CC subtitles enabled on YouTube.')
}

export default function Home() {
  const [url, setUrl]           = useState('')
  const [mode, setMode]         = useState<SummaryMode>('bullets')
  const [status, setStatus]     = useState<Status>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError]       = useState('')
  const [result, setResult]     = useState<SummaryResult | null>(null)
  const [videoMeta, setVideoMeta] = useState({ title: '', wordCount: 0, videoId: '' })
  const [quizTab, setQuizTab]   = useState(false)
  const [answers, setAnswers]   = useState<Record<number, number>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setResult(null); setStatus('idle'); setError('')
    setUrl(''); setAnswers({}); setQuizTab(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSubmit = async () => {
    setError('')
    const videoId = extractVideoId(url)
    if (!videoId) { setError('Paste a valid YouTube URL first.'); return }

    setStatus('fetching')
    setStatusMsg('fetching transcript from YouTube...')

    try {
      // Step 1: fetch transcript in the browser (not blocked by YouTube)
      const { transcript, title, wordCount } = await fetchYouTubeTranscript(videoId)

      // Step 2: send to server only for Claude summarization
      setStatus('summarizing')
      setStatusMsg('summarizing with Claude AI...')

      const summaryRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, title, mode, wordCount }),
      })
      const summaryData = await summaryRes.json()
      if (!summaryRes.ok) {
        setStatus('error')
        setError(summaryData.error || 'Summarization failed')
        return
      }

      setVideoMeta({ title, wordCount, videoId })
      setResult(summaryData)
      setStatus('done')
    } catch (err: unknown) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  const pick = (qi: number, chosen: number) => {
    if (answers[qi] !== undefined) return
    setAnswers(prev => ({ ...prev, [qi]: chosen }))
  }

  const loading = status === 'fetching' || status === 'summarizing'

  return (
    <main className={styles.main}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg viewBox="0 0 24 24" fill="white" width={18} height={18}>
            <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.1 2.8 12 2.8 12 2.8s-4.1 0-6.8.2c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2 .3 4.2.3 4.2s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.3 21.6 12 21.6 12 21.6s4.1 0 6.8-.3c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.2v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z"/>
          </svg>
        </div>
        <h1>TubeDigest</h1>
      </div>
      <p className={styles.tagline}>// paste a youtube link → instant ai summary</p>

      {!result ? (
        <div className={styles.inputArea}>
          <div className={styles.card}>
            <label className={styles.label}>YouTube URL</label>
            <div className={styles.urlRow}>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && handleSubmit()}
                disabled={loading}
              />
              <button
                className={`${styles.goBtn} ${loading ? styles.spinning : ''}`}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? '' : 'Summarize'}
              </button>
            </div>
            <div className={styles.modes}>
              {MODES.map(m => (
                <button
                  key={m.id}
                  className={`${styles.modeBtn} ${mode === m.id ? styles.modeActive : ''}`}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className={styles.statusBar}>
              <div className={styles.dot} />
              <span>{statusMsg}</span>
            </div>
          )}

          {status === 'error' && error && (
            <div className={styles.errorBox}>&gt; {error}</div>
          )}
        </div>
      ) : (
        <div className={styles.result}>
          <div className={styles.resultTop}>
            <div>
              <div className={styles.vidTitle}>{videoMeta.title}</div>
              <div className={styles.vidMeta}>
                ~{videoMeta.wordCount.toLocaleString()} words · {mode} mode · {videoMeta.videoId}
              </div>
            </div>
            <button className={styles.resetBtn} onClick={reset}>← new video</button>
          </div>

          <div className={styles.tldrBox}>
            <div className={styles.tldrLabel}>TL;DR</div>
            <div className={styles.tldrText}>{result.tldr}</div>
          </div>

          {result.bullet_points?.length > 0 && (
            <>
              <div className={styles.secLabel}>key points</div>
              <ul className={styles.bullets}>
                {result.bullet_points.map((b, i) => (
                  <li key={i}><span className={styles.arr}>→</span><span>{b}</span></li>
                ))}
              </ul>
            </>
          )}

          {result.notable_quotes?.length > 0 && (
            <>
              <div className={styles.secLabel}>notable quotes</div>
              <div className={styles.quotesGrid}>
                {result.notable_quotes.slice(0, 3).map((q, i) => (
                  <div key={i} className={styles.quoteCard}>{q}</div>
                ))}
              </div>
            </>
          )}

          <div className={styles.secLabel}>quiz</div>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${!quizTab ? styles.tabActive : ''}`} onClick={() => setQuizTab(false)}>summary</button>
            <button className={`${styles.tab} ${quizTab ? styles.tabActive : ''}`} onClick={() => setQuizTab(true)}>quiz me</button>
          </div>

          {quizTab && result.quiz?.length > 0 && (
            <div className={styles.quizArea}>
              {result.quiz.map((q, qi) => (
                <div key={qi} className={styles.quizQ}>
                  <div className={styles.qText}>{qi + 1}. {q.question}</div>
                  <div className={styles.qOpts}>
                    {q.options.map((opt, oi) => {
                      const answered = answers[qi] !== undefined
                      const isChosen = answers[qi] === oi
                      const isCorrect = q.answer === oi
                      let cls = styles.qOpt
                      if (answered && isCorrect) cls += ' ' + styles.correct
                      else if (answered && isChosen) cls += ' ' + styles.wrong
                      return (
                        <button key={oi} className={cls} onClick={() => pick(qi, oi)} disabled={answered}>
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
