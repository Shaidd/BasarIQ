import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/supabase/types'
import type { ExtractionRow } from '@/lib/types/ocr'

export type { ExtractionRow }

const EXTRACTION_PROMPT = `You are a beef price extraction assistant for Israeli butcher shops and supermarkets.

Analyze this image of a price tag, shelf label, or receipt.

Extract ALL meat prices visible. For each price item return a JSON object with exactly these fields:
- raw_text: the exact text you see for this item (Hebrew or English as shown)
- matched_cut_id: null
- matched_cut_name: the meat cut name as you read it (Hebrew or English)
- price: the numeric price in ILS (₪) as shown — do NOT convert units
- unit: one of "per_kg" | "per_100g" | "per_unit" | "ambiguous"
  • "per_kg"   → label shows /ק"ג or /kg
  • "per_100g" → label shows /100g or /100 גרם
  • "per_unit" → price is per piece or package
  • "ambiguous"→ unclear
- confidence: 0.0–1.0 (how confident you are in this extraction)
- needs_review: true if unit is "ambiguous", or you are unsure about the cut name, or the price seems unusual

Return ONLY a valid JSON array of these objects — no preamble, no explanation.
If no meat prices are visible, return an empty array: []`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const image = formData.get('image') as File | null
  const vendorId = formData.get('vendorId') as string | null

  if (!image || !vendorId) {
    return NextResponse.json({ error: 'Missing image or vendorId' }, { status: 400 })
  }

  const arrayBuffer = await image.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mediaType = (
    ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(image.type)
      ? image.type
      : 'image/jpeg'
  ) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  // Upload to Supabase Storage
  const storagePath = `${user.id}/${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(storagePath, arrayBuffer, { contentType: mediaType })

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // Insert photos row before calling Claude so the audit trail exists even on API failure
  const { data: photoRow, error: photoInsertError } = await supabase
    .from('photos')
    .insert({ storage_path: storagePath, vendor_id: vendorId, uploaded_by: user.id })
    .select('id')
    .single()

  if (photoInsertError || !photoRow) {
    return NextResponse.json(
      { error: `Photo record failed: ${photoInsertError?.message}` },
      { status: 500 }
    )
  }

  // Call Claude API for vision extraction
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let extractionRows: ExtractionRow[] = []

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    })

    const text = message.content.find(b => b.type === 'text')?.text ?? '[]'
    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    extractionRows = JSON.parse(cleaned) as ExtractionRow[]
  } catch {
    // Claude call or JSON parse failed — return empty extraction; photo is already saved
    extractionRows = []
  }

  // Run alias resolution for each row that has a cut name
  const resolvedRows = await Promise.all(
    extractionRows.map(async row => {
      if (!row.matched_cut_name) return row
      const { data } = await supabase.rpc('resolve_cut_alias', { raw: row.matched_cut_name })
      if (data && data.length > 0) {
        return { ...row, matched_cut_id: (data[0] as { cut_id: string }).cut_id }
      }
      return row
    })
  )

  // Persist extraction JSON back onto the photos row for the audit trail
  await supabase
    .from('photos')
    .update({ extraction_json: resolvedRows as unknown as Json })
    .eq('id', photoRow.id)

  return NextResponse.json({ photoId: photoRow.id, rows: resolvedRows })
}
