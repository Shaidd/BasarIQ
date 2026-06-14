// Supabase Edge Function — runs nightly via pg_cron.
// Fetches each active vendor_source, extracts prices via Claude,
// and writes qualifying observations to price_observations.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = 'claude-sonnet-4-6'
const MAX_PAGE_CHARS = 8000

type ExtractionRow = {
  raw_text: string
  matched_cut_id: string | null
  matched_cut_name: string | null
  price: number | null
  unit: 'per_kg' | 'per_100g' | 'per_unit' | 'ambiguous'
  confidence: number
  needs_review: boolean
}

type LogItem = {
  cut_name: string | null
  cut_id?: string
  price?: number
  unit?: string
  action: 'written' | 'queued' | 'dedup' | 'skipped'
  reason?: string
}

// ---------------------------------------------------------------------------
// HTML → plain text (strip tags, collapse whitespace)
// ---------------------------------------------------------------------------
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PAGE_CHARS)
}

// ---------------------------------------------------------------------------
// Claude extraction prompt
// ---------------------------------------------------------------------------
function buildPrompt(pageText: string): string {
  return `You are a beef price extraction assistant for Israeli supermarkets and butcher shops.

Below is text scraped from a vendor's website. Extract ALL meat prices visible.

For each item return a JSON object with exactly these fields:
- raw_text: exact text as found
- matched_cut_id: null
- matched_cut_name: meat cut name (Hebrew or English as shown)
- price: numeric price in ILS — do NOT convert units
- unit: "per_kg" | "per_100g" | "per_unit" | "ambiguous"
- confidence: 0.0–1.0
- needs_review: true if unit ambiguous, cut unclear, or price seems unusual

Return ONLY a valid JSON array. If no meat prices found, return: []

Page text:
${pageText}`
}

// ---------------------------------------------------------------------------
// Call Claude API (raw HTTP — avoids npm dependency in Deno runtime)
// ---------------------------------------------------------------------------
async function callClaude(pageText: string): Promise<ExtractionRow[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(pageText) }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  const text: string = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '[]'
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(cleaned) as ExtractionRow[]
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Fetch all active sources with their vendor's region
  const { data: sources, error: srcErr } = await supabase
    .from('vendor_sources')
    .select('*, vendors(region)')
    .eq('status', 'active')

  if (srcErr || !sources) {
    return new Response(JSON.stringify({ error: srcErr?.message }), { status: 500 })
  }

  const results: Array<{ sourceId: string; result: string; written: number; queued: number }> = []

  for (const source of sources) {
    const vendorRegion = (source.vendors as { region: string } | null)?.region ?? null
    const now = new Date().toISOString()

    // Open an ingestion_run record
    const { data: runRow } = await supabase
      .from('ingestion_runs')
      .insert({ source_id: source.id, started_at: now })
      .select('id')
      .single()
    const runId: string | null = runRow?.id ?? null

    const logItems: LogItem[] = []
    let written = 0
    let queued = 0
    let runResult: 'ok' | 'fetch_error' | 'parse_error' = 'ok'

    try {
      // Fetch the page
      const pageRes = await fetch(source.url, {
        headers: { 'User-Agent': 'BasarIQ/1.0 (+https://basariq.com)' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!pageRes.ok) throw Object.assign(new Error('fetch_error'), { kind: 'fetch_error' })
      const html = await pageRes.text()
      const pageText = stripHtml(html)

      // Extract via Claude
      let rows: ExtractionRow[]
      try {
        rows = await callClaude(pageText)
      } catch {
        throw Object.assign(new Error('parse_error'), { kind: 'parse_error' })
      }

      for (const row of rows) {
        // Must have a cut name and a price
        if (!row.matched_cut_name || row.price === null) {
          logItems.push({ cut_name: row.matched_cut_name, action: 'skipped', reason: 'no_name_or_price' })
          continue
        }

        // Resolve alias → cut_id
        const { data: aliasData } = await supabase.rpc('resolve_cut_alias', { raw: row.matched_cut_name })
        const cutId: string | null = aliasData?.[0]?.cut_id ?? null
        if (!cutId) {
          logItems.push({ cut_name: row.matched_cut_name, action: 'skipped', reason: 'no_alias_match' })
          continue
        }

        // Normalize price to per_kg
        let pricePerKg = row.price
        if (row.unit === 'per_100g') pricePerKg = row.price * 10

        // Dedup: identical (vendor, cut, price) within 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: existing } = await supabase
          .from('price_observations')
          .select('id')
          .eq('vendor_id', source.vendor_id)
          .eq('cut_id', cutId)
          .eq('price_per_kg', pricePerKg)
          .eq('source', 'web_auto')
          .eq('status', 'active')
          .gte('observed_at', sevenDaysAgo)
          .limit(1)

        if (existing && existing.length > 0) {
          await supabase
            .from('price_observations')
            .update({ last_seen_at: now })
            .eq('id', existing[0].id)
          logItems.push({ cut_name: row.matched_cut_name, cut_id: cutId, price: pricePerKg, action: 'dedup' })
          continue
        }

        // Outlier check: price > 3× cut_regional_median
        let autoWrite = !row.needs_review && (row.unit === 'per_kg' || row.unit === 'per_100g')
        if (autoWrite && vendorRegion) {
          const { data: medianData } = await supabase.rpc('cut_regional_median', {
            p_cut_id: cutId,
            p_region: vendorRegion,
          })
          const median: number | null = medianData ?? null
          if (median === null || pricePerKg > median * 3) {
            autoWrite = false // outlier or no baseline → queue for review
          }
        } else if (autoWrite && !vendorRegion) {
          autoWrite = false // no region → can't check outlier → queue
        }

        // Insert observation
        await supabase.from('price_observations').insert({
          vendor_id: source.vendor_id,
          cut_id: cutId,
          price_per_kg: pricePerKg,
          currency: 'ILS',
          source: 'web_auto',
          confidence: row.confidence,
          source_url: source.url,
          raw_text: row.raw_text,
          observed_at: now,
          status: autoWrite ? 'active' : 'hidden',
        })

        if (autoWrite) {
          written++
          logItems.push({ cut_name: row.matched_cut_name, cut_id: cutId, price: pricePerKg, action: 'written' })
        } else {
          queued++
          logItems.push({ cut_name: row.matched_cut_name, cut_id: cutId, price: pricePerKg, unit: row.unit, action: 'queued' })
        }
      }

      // Mark source healthy
      await supabase
        .from('vendor_sources')
        .update({ last_run_at: now, fail_count: 0 })
        .eq('id', source.id)

    } catch (err) {
      const e = err as { kind?: string }
      runResult = e.kind === 'fetch_error' ? 'fetch_error' : 'parse_error'

      // Increment fail count; mark broken at 3 failures
      const newFailCount = (source.fail_count ?? 0) + 1
      await supabase
        .from('vendor_sources')
        .update({
          fail_count: newFailCount,
          last_run_at: now,
          ...(newFailCount >= 3 ? { status: 'broken' } : {}),
        })
        .eq('id', source.id)
    }

    // Close the ingestion_run
    if (runId) {
      await supabase
        .from('ingestion_runs')
        .update({
          finished_at: new Date().toISOString(),
          result: runResult,
          observations_written: written,
          queued_for_review: queued,
          log: { items: logItems },
        })
        .eq('id', runId)
    }

    results.push({ sourceId: source.id, result: runResult, written, queued })
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
