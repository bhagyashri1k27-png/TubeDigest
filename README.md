# TubeDigest 🎬

AI-powered YouTube video summarizer. Paste any YouTube link → get instant summaries, key quotes, and a quiz.

**Built with:** Next.js 14 · Claude API (Anthropic) · TypeScript

---

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.example .env.local
# Edit .env.local and paste your Anthropic API key
# Get one free at https://console.anthropic.com

# 3. Run
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Vercel (5 minutes)

### Option A — GitHub + Vercel (recommended)

1. Push this project to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variable: `ANTHROPIC_API_KEY` = your key
4. Click Deploy → done ✅

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel
# Follow prompts, then add your env var:
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

---

## Features

- 🔗 Paste any YouTube URL — no manual transcript copying
- 4 summary modes: bullet points, detailed, ELI5, TL;DR
- Key quotes extracted from the video
- Interactive quiz to test your understanding
- Works with any video that has captions (CC) enabled

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| AI | Anthropic Claude claude-sonnet-4-20250514 |
| Transcripts | youtube-transcript npm package |
| Styling | CSS Modules |
| Deploy | Vercel |

## Notes

- Videos must have captions/subtitles enabled on YouTube
- Auto-generated captions work too
- Private or age-restricted videos are not supported
