import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { SummaryMode } from '@/lib/youtube'

const client = new Anthropic()

const modeInstructions: Record<SummaryMode, string> = {
  bullets: 'Extract 6-8 concise bullet points covering the key ideas.',
  detailed: 'Extract 10-12 detailed bullet points with context and nuance.',
  eli5: 'Explain like I am 5. Simple words and fun analogies. 5-6 bullet points.',
  tldr: 'Just write a great TL;DR. Set bullet_points to an empty array.',
}

export async function POST(req: NextRequest) {
  const { transcript, title, mode, wordCount } = (await req.json()) as {
    transcript: string
    title: string
    mode: SummaryMode
    wordCount: number
  }

  if (!transcript) {
    return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
  }

  const prompt = `Summarize this YouTube video transcript. Return ONLY valid JSON, no markdown fences, no explanation.

Video title: "${title || 'Unknown'}"
Mode: ${mode} — ${modeInstructions[mode]}

Return exactly this JSON structure:
{
  "tldr": "one punchy sentence summary",
  "bullet_points": ["point 1", "point 2"],
  "notable_quotes": ["exact short quote 1", "exact short quote 2", "exact short quote 3"],
  "quiz": [
    {"question": "...", "options": ["A", "B", "C", "D"], "answer": 0},
    {"question": "...", "options": ["A", "B", "C", "D"], "answer": 2},
    {"question": "...", "options": ["A", "B", "C", "D"], "answer": 1}
  ]
}

TRANSCRIPT (${wordCount} words):
${transcript.slice(0, 10000)}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const clean = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  return NextResponse.json(parsed)
}
