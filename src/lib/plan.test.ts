import { describe, it, expect } from 'vitest'
import { buildHouseholdPlan, normalizeInputs, recommendedSupplyDays, planToText, WATER_GAL_PER_PERSON_DAY, WATER_GAL_PER_PET_DAY } from './plan'

const site = { mmiLevel: 8, siteClass: 'D' as const, siteClassIsProxy: true, liquefactionProxy: 'higher' as const }

describe('household plan — deterministic arithmetic', () => {
  it('water is people × 1 gal × days, pets separate and flagged as an assumption', () => {
    const p = buildHouseholdPlan({ adults: 2, children: 2, infants: 0, pets: 1, supplyDays: 14 }, site)
    const supplies = p.sections.find((s) => s.id === 'supplies')!
    const water = supplies.quantities.find((q) => q.label.startsWith('Drinking'))!
    expect(water.value).toBe(4 * WATER_GAL_PER_PERSON_DAY * 14)
    expect(water.arithmetic).toContain('4 people × 1 gal/day × 14 days')
    const pets = supplies.quantities.find((q) => q.label.startsWith('Water for pets'))!
    expect(pets.value).toBe(1 * WATER_GAL_PER_PET_DAY * 14)
    expect(pets.assumption).toBeTruthy()
  })

  it('is deterministic: same inputs, identical output', () => {
    const a = buildHouseholdPlan({ adults: 1, pets: 2, supplyDays: 7 }, site)
    const b = buildHouseholdPlan({ adults: 1, pets: 2, supplyDays: 7 }, site)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('never produces NaN or negative quantities from bad input', () => {
    const p = buildHouseholdPlan({ adults: -3, children: NaN, pets: 99, supplyDays: 5 as never }, site)
    for (const s of p.sections) for (const q of s.quantities) {
      expect(Number.isFinite(q.value)).toBe(true)
      expect(q.value).toBeGreaterThanOrEqual(0)
    }
    expect(normalizeInputs({ pets: 99 }).pets).toBe(20)
  })

  it('recommends a longer horizon as modeled intensity rises', () => {
    expect(recommendedSupplyDays(4).days).toBe(3)
    expect(recommendedSupplyDays(6).days).toBe(7)
    expect(recommendedSupplyDays(9).days).toBe(14)
  })

  it('adds gas guidance only when the home has gas, and mobile-home guidance only for mobile homes', () => {
    const gas = buildHouseholdPlan({ hasNaturalGas: true, homeType: 'mobile' }, site)
    const noGas = buildHouseholdPlan({ hasNaturalGas: false, homeType: 'apartment' }, site)
    const txt = (p: typeof gas) => p.sections.flatMap((s) => s.items.map((i) => i.text)).join('\n')
    expect(txt(gas)).toMatch(/gas meter/)
    expect(txt(gas)).toMatch(/Manufactured homes/)
    expect(txt(noGas)).not.toMatch(/gas meter/)
    expect(txt(noGas)).toMatch(/elevators/)
  })

  it('every item and quantity names a source', () => {
    const p = buildHouseholdPlan({ adults: 3, infants: 1, dailyMedications: true, powerDependentMedical: true, mobilityAssistance: true }, site)
    for (const s of p.sections) {
      for (const q of s.quantities) expect(q.source.length).toBeGreaterThan(3)
      for (const i of s.items) expect(i.source.length).toBeGreaterThan(2)
    }
  })

  it('exports plain text with the arithmetic visible', () => {
    const t = planToText(buildHouseholdPlan({ adults: 2, supplyDays: 3 }, site), 'Test address')
    expect(t).toContain('2 people × 1 gal/day × 3 days')
  })
})
