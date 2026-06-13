// TypeScript mirrors of the SQL functions in 00004_functions.sql.
// Used by Edge Functions and unit tests — no DB required.

/**
 * Mirrors public.normalize_alias_input(raw text).
 * Strips Hebrew nikud (U+05B0–U+05C7, U+05F0–U+05F4), replaces any
 * non-Hebrew-letter / non-ASCII-alphanumeric character with a space,
 * then lowercases and trims.
 */
export function normalizeAliasInput(raw: string): string {
  return raw
    .replace(/[ְ-ׇװ-״]/g, '')       // strip nikud + digraphs
    .replace(/[^א-ת׳״a-zA-Z0-9 ]/g, ' ') // non-alpha → space
    .toLowerCase()
    .trim()
    .replace(/  +/g, ' ')                                  // collapse multiple spaces
}

export type Freshness = 'fresh' | 'stale' | 'expired'
export type ObservationSource = 'manual' | 'photo' | 'web_auto'

/**
 * Mirrors public.observation_freshness().
 * Returns 'fresh' | 'stale' | 'expired' for a given observation.
 */
export function observationFreshness(
  source: ObservationSource,
  observedAt: Date,
  isSale = false,
  saleEndsAt?: Date | null,
): Freshness {
  const now = new Date()
  const ageMs = now.getTime() - observedAt.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  if (isSale && saleEndsAt != null && saleEndsAt < now) return 'expired'
  if (source === 'web_auto' && ageDays > 7) return 'expired'
  if ((source === 'manual' || source === 'photo') && ageDays > 21) return 'expired'
  if (ageDays > 7) return 'stale'
  return 'fresh'
}
