// Shared contract between the OCR API route, the save server action, and the confirm UI.
// This mirrors the ExtractionRow from the CLAUDE.md spec.
export type ExtractionRow = {
  raw_text: string
  matched_cut_id: string | null
  matched_cut_name: string | null
  price: number | null
  unit: 'per_kg' | 'per_100g' | 'per_unit' | 'ambiguous'
  confidence: number
  needs_review: boolean
}
