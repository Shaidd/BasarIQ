import { scoreVendors, type ScoreVendorsParams } from '../sourcing'
import type { Tables } from '@/supabase/types'

type VendorRow = Tables<'vendors'>
type PriceRow = Pick<
  Tables<'price_observations'>,
  'vendor_id' | 'cut_id' | 'price_per_kg' | 'source' | 'is_sale' | 'sale_ends_at' | 'observed_at'
>

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeVendor(overrides: Partial<VendorRow> = {}): VendorRow {
  return {
    id: 'v1',
    name: 'Test Butcher',
    type: 'butcher',
    region: 'center',
    city: 'Tel Aviv',
    address: null,
    lat: 32.08,
    lng: 34.78,
    phone: null,
    website: null,
    delivers: false,
    delivery_regions: null,
    delivery_fee: null,
    delivery_min_order: null,
    rating: null,
    status: 'active',
    created_by: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makePrice(overrides: Partial<PriceRow> = {}): PriceRow {
  return {
    vendor_id: 'v1',
    cut_id: 'c1',
    price_per_kg: 100,
    source: 'manual',
    is_sale: false,
    sale_ends_at: null,
    observed_at: new Date().toISOString(), // today → fresh
    ...overrides,
  }
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const USER_LAT = 32.08
const USER_LNG = 34.78

const CUT_NAMES: ScoreVendorsParams['cutNamesById'] = new Map([
  ['c1', { name_en: 'Ribeye', name_he: 'אנטרקוט' }],
  ['c2', { name_en: 'Brisket', name_he: 'חזה' }],
])

// ---------------------------------------------------------------------------
// scoreVendors — core business logic
// ---------------------------------------------------------------------------

describe('scoreVendors', () => {
  describe('empty / no-op cases', () => {
    it('returns [] when items list is empty', () => {
      const result = scoreVendors({
        items: [],
        pickupVendors: [makeVendor()],
        deliveryVendors: [],
        pricesByVendorCut: new Map(),
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toEqual([])
    })

    it('returns [] when all items have kg = 0', () => {
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 0 }],
        pickupVendors: [makeVendor()],
        deliveryVendors: [],
        pricesByVendorCut: new Map([['v1:c1', makePrice()]]),
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toEqual([])
    })
  })

  describe('fresh prices — happy path', () => {
    it('returns correct total for a pickup vendor with fresh prices', () => {
      const vendor = makeVendor({ id: 'v1', lat: 32.08, lng: 34.78 })
      const pricesByVendorCut = new Map<string, PriceRow>([
        ['v1:c1', makePrice({ price_per_kg: 100 })],
      ])
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 2 }],
        pickupVendors: [vendor],
        deliveryVendors: [],
        pricesByVendorCut,
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toHaveLength(1)
      expect(result[0].total_ils).toBe(200)
      expect(result[0].coverage_pct).toBe(1)
      expect(result[0].line_items[0].is_penalized).toBe(false)
    })

    it('marks pickup vendor with distance_km', () => {
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 1 }],
        pickupVendors: [makeVendor({ id: 'v1', lat: 32.08, lng: 34.78 })],
        deliveryVendors: [],
        pricesByVendorCut: new Map([['v1:c1', makePrice()]]),
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result[0].pickup_or_delivery).toBe('pickup')
      // Same coordinates — distance should be ~0
      expect(result[0].distance_km).toBeCloseTo(0, 1)
    })

    it('marks delivery vendor with null distance_km', () => {
      const vendor = makeVendor({ id: 'v1', delivers: true, delivery_regions: ['*'], delivery_fee: 30, lat: null, lng: null })
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 1 }],
        pickupVendors: [],
        deliveryVendors: [vendor],
        pricesByVendorCut: new Map([['v1:c1', makePrice()]]),
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result[0].pickup_or_delivery).toBe('delivery')
      expect(result[0].distance_km).toBeNull()
    })

    it('adds delivery_fee to total_ils', () => {
      const vendor = makeVendor({ id: 'v1', delivers: true, delivery_regions: ['*'], delivery_fee: 30, lat: null, lng: null })
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 2 }],
        pickupVendors: [],
        deliveryVendors: [vendor],
        pricesByVendorCut: new Map([['v1:c1', makePrice({ price_per_kg: 100 })]]),
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result[0].total_ils).toBe(230) // 200 items + 30 delivery
    })
  })

  describe('coverage threshold', () => {
    it('excludes vendor covering < 70% of list weight', () => {
      // 3 kg list, vendor has price for 2 kg cut (c1) but not for 1.5 kg cut (c2)
      // No median either, so c2 is uncovered. coverage = 2/3.5 ≈ 57%
      const vendor = makeVendor({ id: 'v1' })
      const result = scoreVendors({
        items: [
          { cut_id: 'c1', kg: 2 },
          { cut_id: 'c2', kg: 1.5 },
        ],
        pickupVendors: [vendor],
        deliveryVendors: [],
        pricesByVendorCut: new Map([['v1:c1', makePrice({ cut_id: 'c1' })]]),
        mediansByRegionCut: new Map(), // no medians
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toHaveLength(0)
    })

    it('includes vendor covering exactly 70% of list weight', () => {
      // 10 kg list: c1=7kg (covered), c2=3kg (uncovered, no median). coverage = 70%
      const vendor = makeVendor({ id: 'v1' })
      const result = scoreVendors({
        items: [
          { cut_id: 'c1', kg: 7 },
          { cut_id: 'c2', kg: 3 },
        ],
        pickupVendors: [vendor],
        deliveryVendors: [],
        pricesByVendorCut: new Map([['v1:c1', makePrice({ cut_id: 'c1', price_per_kg: 100 })]]),
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toHaveLength(1)
      expect(result[0].coverage_pct).toBeCloseTo(0.7, 5)
    })
  })

  describe('penalty pricing', () => {
    it('uses median × 1.15 for an expired price', () => {
      const vendor = makeVendor({ id: 'v1', region: 'center' })
      const expiredPrice = makePrice({ observed_at: daysAgo(25) }) // manual, 25d → expired
      const median = 80
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 2 }],
        pickupVendors: [vendor],
        deliveryVendors: [],
        pricesByVendorCut: new Map([['v1:c1', expiredPrice]]),
        mediansByRegionCut: new Map([['center:c1', median]]),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toHaveLength(1)
      const line = result[0].line_items[0]
      expect(line.is_penalized).toBe(true)
      expect(line.freshness).toBe('expired')
      expect(line.price_per_kg).toBe(expiredPrice.price_per_kg) // original kept for display
      expect(line.subtotal).toBeCloseTo(median * 1.15 * 2, 5)
    })

    it('uses median × 1.15 for a missing price (no observation at all)', () => {
      const vendor = makeVendor({ id: 'v1', region: 'center' })
      const median = 90
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 1 }],
        pickupVendors: [vendor],
        deliveryVendors: [],
        pricesByVendorCut: new Map(), // no price
        mediansByRegionCut: new Map([['center:c1', median]]),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toHaveLength(1)
      const line = result[0].line_items[0]
      expect(line.is_penalized).toBe(true)
      expect(line.price_per_kg).toBeNull()
      expect(line.subtotal).toBeCloseTo(median * 1.15, 5)
    })

    it('excludes vendor when expired price has no regional median and coverage drops < 70%', () => {
      // c1=5kg expired+no median (uncovered), c2=2kg fresh. total=7kg, covered=2kg → 29% < 70%
      const vendor = makeVendor({ id: 'v1', region: 'center' })
      const result = scoreVendors({
        items: [
          { cut_id: 'c1', kg: 5 },
          { cut_id: 'c2', kg: 2 },
        ],
        pickupVendors: [vendor],
        deliveryVendors: [],
        pricesByVendorCut: new Map([
          ['v1:c1', makePrice({ cut_id: 'c1', observed_at: daysAgo(25) })], // expired
          ['v1:c2', makePrice({ cut_id: 'c2' })],                            // fresh
        ]),
        mediansByRegionCut: new Map(), // no median for c1
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toHaveLength(0)
    })
  })

  describe('delivery minimum order', () => {
    it('excludes delivery vendor when order total is below delivery_min_order', () => {
      const vendor = makeVendor({
        id: 'v1',
        delivers: true,
        delivery_regions: ['*'],
        delivery_fee: 0,
        delivery_min_order: 500,
        lat: null,
        lng: null,
      })
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 1 }],
        pickupVendors: [],
        deliveryVendors: [vendor],
        pricesByVendorCut: new Map([['v1:c1', makePrice({ price_per_kg: 100 })]]),
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toHaveLength(0) // 100 < 500 minimum
    })

    it('includes delivery vendor meeting delivery_min_order', () => {
      const vendor = makeVendor({
        id: 'v1',
        delivers: true,
        delivery_regions: ['*'],
        delivery_fee: 20,
        delivery_min_order: 100,
        lat: null,
        lng: null,
      })
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 2 }],
        pickupVendors: [],
        deliveryVendors: [vendor],
        pricesByVendorCut: new Map([['v1:c1', makePrice({ price_per_kg: 100 })]]),
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toHaveLength(1) // 200 >= 100 minimum
    })
  })

  describe('sorting', () => {
    it('sorts candidates ascending by total_ils', () => {
      const v1 = makeVendor({ id: 'v1', name: 'Expensive', lat: 32.08, lng: 34.78 })
      const v2 = makeVendor({ id: 'v2', name: 'Cheap', lat: 32.08, lng: 34.78 })
      const result = scoreVendors({
        items: [{ cut_id: 'c1', kg: 1 }],
        pickupVendors: [v1, v2],
        deliveryVendors: [],
        pricesByVendorCut: new Map([
          ['v1:c1', makePrice({ vendor_id: 'v1', price_per_kg: 200 })],
          ['v2:c1', makePrice({ vendor_id: 'v2', price_per_kg: 80 })],
        ]),
        mediansByRegionCut: new Map(),
        cutNamesById: CUT_NAMES,
        userLat: USER_LAT,
        userLng: USER_LNG,
      })
      expect(result).toHaveLength(2)
      expect(result[0].vendor_name).toBe('Cheap')
      expect(result[1].vendor_name).toBe('Expensive')
    })
  })
})

// ---------------------------------------------------------------------------
// haversineKm — tested indirectly via distance_km on pickup results
// ---------------------------------------------------------------------------

describe('haversineKm (via distance_km)', () => {
  function getDistance(vendorLat: number, vendorLng: number): number | null {
    const vendor = makeVendor({ id: 'v1', lat: vendorLat, lng: vendorLng })
    const result = scoreVendors({
      items: [{ cut_id: 'c1', kg: 1 }],
      pickupVendors: [vendor],
      deliveryVendors: [],
      pricesByVendorCut: new Map([['v1:c1', makePrice()]]),
      mediansByRegionCut: new Map(),
      cutNamesById: CUT_NAMES,
      userLat: USER_LAT,
      userLng: USER_LNG,
    })
    return result[0]?.distance_km ?? null
  }

  it('returns ~0 km for same coordinates', () => {
    expect(getDistance(USER_LAT, USER_LNG)).toBeCloseTo(0, 1)
  })

  it('returns ~55 km for Tel Aviv → Jerusalem', () => {
    // Jerusalem: ~31.78, 35.22
    const dist = getDistance(31.78, 35.22)
    expect(dist).not.toBeNull()
    expect(dist!).toBeGreaterThan(50)
    expect(dist!).toBeLessThan(60)
  })
})
