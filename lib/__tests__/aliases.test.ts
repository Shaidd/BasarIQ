import { normalizeAliasInput, observationFreshness } from '../aliases'

// ---------------------------------------------------------------------------
// normalizeAliasInput
// ---------------------------------------------------------------------------

describe('normalizeAliasInput', () => {
  describe('nikud stripping', () => {
    it('strips Hebrew vowel points', () => {
      // אַנְטְרֶקוֹט with dagesh/sheva/patach/holam
      expect(normalizeAliasInput('אַנְטְרֶקוֹט')).toBe('אנטרקוט')
    })

    it('leaves plain Hebrew letters unchanged', () => {
      expect(normalizeAliasInput('אנטרקוט')).toBe('אנטרקוט')
    })
  })

  describe('punctuation stripping', () => {
    it('replaces ₪ with space', () => {
      expect(normalizeAliasInput('פילה ₪')).toBe('פילה')
    })

    it('replaces / with space', () => {
      expect(normalizeAliasInput('שריר/כתף')).toBe('שריר כתף')
    })

    it('replaces ( ) with spaces and collapses them', () => {
      expect(normalizeAliasInput('כסל (כמו מותן)')).toBe('כסל כמו מותן')
    })

    it('strips leading/trailing punctuation', () => {
      expect(normalizeAliasInput('  אסאדו  ')).toBe('אסאדו')
    })
  })

  describe('lowercasing', () => {
    it('lowercases English', () => {
      expect(normalizeAliasInput('Ribeye')).toBe('ribeye')
    })

    it('handles mixed Hebrew + English', () => {
      expect(normalizeAliasInput('Short Ribs')).toBe('short ribs')
    })
  })

  describe('known alias round-trips', () => {
    const cases: [string, string][] = [
      ['אנטרקוט',       'אנטרקוט'],      // Ribeye
      ['סינטה',          'סינטה'],         // Short Loin
      ['פילה',           'פילה'],          // Tenderloin
      ['שייטל',          'שייטל'],         // Sirloin
      ['אסאדו',          'אסאדו'],         // Short Ribs Flanken-cut
      ['tenderloin',     'tenderloin'],
      ['short ribs',     'short ribs'],
    ]

    test.each(cases)('normalizeAliasInput(%s) → %s', (input, expected) => {
      expect(normalizeAliasInput(input)).toBe(expected)
    })
  })
})

// ---------------------------------------------------------------------------
// observationFreshness
// ---------------------------------------------------------------------------

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

describe('observationFreshness', () => {
  describe('manual / photo source', () => {
    it('is fresh within 7 days', () => {
      expect(observationFreshness('manual', daysAgo(3))).toBe('fresh')
      expect(observationFreshness('photo', daysAgo(6))).toBe('fresh')
    })

    it('is stale between 8–21 days', () => {
      expect(observationFreshness('manual', daysAgo(8))).toBe('stale')
      expect(observationFreshness('photo', daysAgo(20))).toBe('stale')
    })

    it('is expired after 21 days', () => {
      expect(observationFreshness('manual', daysAgo(22))).toBe('expired')
      expect(observationFreshness('photo', daysAgo(100))).toBe('expired')
    })
  })

  describe('web_auto source', () => {
    it('is fresh within 7 days', () => {
      expect(observationFreshness('web_auto', daysAgo(5))).toBe('fresh')
    })

    it('is expired after 7 days', () => {
      expect(observationFreshness('web_auto', daysAgo(8))).toBe('expired')
    })
  })

  describe('sale expiry', () => {
    it('expires a sale when saleEndsAt is in the past', () => {
      expect(
        observationFreshness('manual', daysAgo(1), true, daysAgo(1)),
      ).toBe('expired')
    })

    it('is still fresh when saleEndsAt is in the future', () => {
      expect(
        observationFreshness('manual', daysAgo(1), true, daysFromNow(3)),
      ).toBe('fresh')
    })

    it('ignores sale expiry when isSale is false', () => {
      expect(
        observationFreshness('manual', daysAgo(1), false, daysAgo(1)),
      ).toBe('fresh')
    })
  })
})
