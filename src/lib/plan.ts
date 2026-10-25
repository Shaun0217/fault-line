/**
 * plan.ts — household earthquake plan. Structured, deterministic, and free of
 * any language model or network call (CLAUDE.md, Hard Invariant 6). Every
 * quantity is computed with arithmetic the UI shows next to the number, and
 * every rule names its source.
 *
 * Sources
 *  [R1] Ready.gov, "Build a Kit" (FEMA): one gallon of water per person per day
 *       for several days, for drinking and sanitation; several days of
 *       non-perishable food; prescription medications; flashlight; battery or
 *       hand-crank radio (NOAA Weather Radio); first aid kit; extra batteries;
 *       whistle; dust mask; wrench or pliers to turn off utilities; manual can
 *       opener; local maps; cell phone with chargers and a backup battery.
 *       https://www.ready.gov/kit
 *  [R2] Ready.gov, "Make a Plan": household communication plan, an out-of-town
 *       contact, and meeting places near home, in the neighborhood, and outside
 *       the neighborhood. https://www.ready.gov/plan
 *  [R3] Ready.gov, "Earthquakes": Drop, Cover, and Hold On; secure heavy items;
 *       after shaking, expect aftershocks; if you smell gas or hear a hissing
 *       sound, leave and shut off the gas if you can; text rather than call.
 *       https://www.ready.gov/earthquakes
 *  [R4] Ready.gov, "Pets and Animals": include food, water and medicine for
 *       pets in the kit. https://www.ready.gov/pets
 *  [R5] FEMA P-528 / FEMA "Earthquake Safety at Home": strap water heaters,
 *       anchor tall furniture, know the location of gas, water and electric
 *       shutoffs; only the utility company should turn gas back on.
 *  [R6] Elnashai, A. S., et al. (2009). Impact of New Madrid Seismic Zone
 *       Earthquakes on the Central USA, Vol. I & II. Mid-America Earthquake
 *       Center Report 09-03. Scenario NMSZ events produce utility outages lasting
 *       weeks in the most-affected counties, not days.
 *  [R7] USGS ShakeMap instrumental-intensity legend (Wald et al. 1999): potential
 *       damage wording by MMI band.
 *
 * Assumptions that are not from a published source are marked ASSUMPTION and the
 * UI displays that flag next to the number.
 */

import type { SiteClass } from './siteclass'

export type HomeType = 'house' | 'apartment' | 'mobile'
export type SupplyDays = 3 | 7 | 14

export interface HouseholdInputs {
  adults: number
  children: number
  infants: number
  pets: number
  supplyDays: SupplyDays
  homeType: HomeType
  hasNaturalGas: boolean
  dailyMedications: boolean
  powerDependentMedical: boolean
  mobilityAssistance: boolean
}

export interface SiteContext {
  /** Integer MMI band for the planning scenario at the address (1..10). */
  mmiLevel: number
  siteClass: SiteClass
  /** Whether the site class came from a proxy (slope) rather than a measurement. */
  siteClassIsProxy: boolean
  liquefactionProxy: 'higher' | 'moderate' | 'lower' | 'unknown'
}

export interface Quantity {
  label: string
  value: number
  unit: string
  /** Visible arithmetic, e.g. "4 people × 1 gal × 14 days". */
  arithmetic: string
  source: string
  assumption?: string
}

export interface PlanItem {
  text: string
  source: string
  assumption?: string
}

export interface PlanSection {
  id: string
  title: string
  summary: string
  quantities: Quantity[]
  items: PlanItem[]
}

export interface HouseholdPlan {
  people: number
  supplyDays: SupplyDays
  recommendedDays: SupplyDays
  recommendedDaysReason: string
  sections: PlanSection[]
}

export const DEFAULT_HOUSEHOLD: HouseholdInputs = {
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
  supplyDays: 14,
  homeType: 'house',
  hasNaturalGas: true,
  dailyMedications: false,
  powerDependentMedical: false,
  mobilityAssistance: false,
}

/** [R1]: one gallon per person per day. */
export const WATER_GAL_PER_PERSON_DAY = 1
/** ASSUMPTION: pets — Ready.gov gives no quantity [R4]. Half a gallon per animal per day covers a large dog. */
export const WATER_GAL_PER_PET_DAY = 0.5
/** [R1] minimum; [R6] justifies the longer horizon for NMSZ. */
export const MIN_SUPPLY_DAYS: SupplyDays = 3
/** ASSUMPTION for the medication horizon; Ready.gov says "several days" [R1]. */
export const MEDICATION_DAYS_MIN = 7

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

/** Sanitize inputs so arithmetic is never NaN or negative. */
export function normalizeInputs(input: Partial<HouseholdInputs>): HouseholdInputs {
  const merged = { ...DEFAULT_HOUSEHOLD, ...input }
  return {
    ...merged,
    adults: clampInt(merged.adults, 0, 20),
    children: clampInt(merged.children, 0, 20),
    infants: clampInt(merged.infants, 0, 10),
    pets: clampInt(merged.pets, 0, 20),
    supplyDays: ([3, 7, 14] as const).includes(merged.supplyDays) ? merged.supplyDays : 14,
  }
}

/** Longer horizon where the scenario intensity implies infrastructure damage [R6],[R7]. */
export function recommendedSupplyDays(mmiLevel: number): { days: SupplyDays; reason: string } {
  if (mmiLevel >= 8) {
    return {
      days: 14,
      reason:
        'Modeled intensity VIII or higher means moderate-to-heavy structural damage nearby. Regional NMSZ scenario studies put utility restoration in the most-affected counties at weeks, not days.',
    }
  }
  if (mmiLevel >= 6) {
    return {
      days: 7,
      reason:
        'Modeled intensity VI–VII means light-to-moderate damage. Expect multi-day power and water disruption while crews reach damaged areas.',
    }
  }
  return {
    days: 3,
    reason: 'Modeled intensity below VI means little structural damage at this address; the standard three-day kit covers the likely disruption.',
  }
}

export function buildHouseholdPlan(rawInput: Partial<HouseholdInputs>, site: SiteContext): HouseholdPlan {
  const h = normalizeInputs(rawInput)
  const people = h.adults + h.children + h.infants
  const days = h.supplyDays
  const rec = recommendedSupplyDays(site.mmiLevel)

  // ---- Water & food -------------------------------------------------------
  const waterPeopleGal = people * WATER_GAL_PER_PERSON_DAY * days
  const waterPetsGal = h.pets * WATER_GAL_PER_PET_DAY * days
  const quantities: Quantity[] = [
    {
      label: 'Drinking and sanitation water',
      value: waterPeopleGal,
      unit: 'gal',
      arithmetic: `${people} ${people === 1 ? 'person' : 'people'} × ${WATER_GAL_PER_PERSON_DAY} gal/day × ${days} days`,
      source: 'Ready.gov Build a Kit [R1]',
    },
  ]
  if (h.pets > 0) {
    quantities.push({
      label: 'Water for pets',
      value: waterPetsGal,
      unit: 'gal',
      arithmetic: `${h.pets} ${h.pets === 1 ? 'pet' : 'pets'} × ${WATER_GAL_PER_PET_DAY} gal/day × ${days} days`,
      source: 'Ready.gov Pets [R4] gives no quantity',
      assumption: `${WATER_GAL_PER_PET_DAY} gal per animal per day is an assumption sized for a large dog; scale down for cats.`,
    })
  }
  quantities.push({
    label: 'Non-perishable food',
    value: people * days,
    unit: 'person-days',
    arithmetic: `${people} people × ${days} days`,
    source: 'Ready.gov Build a Kit [R1]',
  })
  if (h.infants > 0) {
    quantities.push({
      label: 'Infant formula, diapers, wipes',
      value: h.infants * days,
      unit: 'infant-days',
      arithmetic: `${h.infants} infant${h.infants === 1 ? '' : 's'} × ${days} days`,
      source: 'Ready.gov Build a Kit, additional supplies [R1]',
    })
  }
  if (h.dailyMedications) {
    quantities.push({
      label: 'Prescription medication',
      value: Math.max(MEDICATION_DAYS_MIN, days),
      unit: 'days',
      arithmetic: `max(${MEDICATION_DAYS_MIN}, ${days}) days`,
      source: 'Ready.gov Build a Kit [R1] ("several days"); horizon extended for NMSZ [R6]',
      assumption: 'Seven days is the floor used here; Ready.gov gives no exact number.',
    })
  }

  const supplies: PlanSection = {
    id: 'supplies',
    title: 'Water, food and medicine',
    summary:
      days < rec.days
        ? `You chose ${days} days. For this address the recommendation is ${rec.days} days.`
        : `${days}-day supply for ${people} ${people === 1 ? 'person' : 'people'}${h.pets ? ` and ${h.pets} ${h.pets === 1 ? 'pet' : 'pets'}` : ''}.`,
    quantities,
    items: [
      { text: 'Store water in sealed, food-grade containers away from sunlight; replace commercially bottled water by its date.', source: '[R1]' },
      { text: 'Manual can opener. Food that needs no cooking or refrigeration.', source: '[R1]' },
      ...(h.powerDependentMedical
        ? [{ text: 'Someone here depends on powered medical equipment: arrange a backup power source now and register with your utility’s medical-needs program.', source: '[R1] additional supplies; utility programs vary' }]
        : []),
    ],
  }

  // ---- Light, information, tools --------------------------------------------
  const kit: PlanSection = {
    id: 'kit',
    title: 'Power-out essentials',
    summary: 'Everything here works with no electricity and no cell network.',
    quantities: [],
    items: [
      { text: 'Flashlights (not candles) and spare batteries for each.', source: '[R1]' },
      { text: 'Battery or hand-crank NOAA Weather Radio for official instructions when cell service is down.', source: '[R1]' },
      { text: 'First aid kit, whistle to signal for help, dust masks, plastic sheeting and duct tape.', source: '[R1]' },
      { text: 'Phone chargers plus a charged backup battery.', source: '[R1]' },
      { text: 'Paper copies of ID, insurance and bank documents in a waterproof bag; some cash in small bills.', source: '[R1]' },
      { text: 'Sturdy shoes and gloves beside the bed: broken glass is the most common earthquake injury.', source: '[R3]' },
      ...(h.mobilityAssistance
        ? [{ text: 'Spare mobility aids, extra batteries for powered chairs, and a neighbor who has agreed to check on this household.', source: '[R1] additional supplies' }]
        : []),
    ],
  }

  // ---- Utilities ----------------------------------------------------------------
  const utilities: PlanSection = {
    id: 'utilities',
    title: 'Utilities at this home',
    summary: h.hasNaturalGas ? 'You have natural gas service. Learn the shutoff before you need it.' : 'No natural gas here; water and electric shutoffs still matter.',
    quantities: [],
    items: [
      ...(h.hasNaturalGas
        ? [
            { text: 'Find the gas meter and tie a wrench to it. Shut gas off ONLY if you smell gas, hear hissing, or see a broken line.', source: '[R3],[R5]' },
            { text: 'Never turn gas back on yourself. Only the utility company restores it.', source: '[R5]' },
          ]
        : []),
      { text: 'Know where the main water shutoff is; after strong shaking, closing it keeps contaminated water out of your pipes and preserves the clean water in the heater tank.', source: '[R5]' },
      { text: 'Strap the water heater to wall studs. It is both a fire risk and up to 40–50 gallons of emergency water.', source: '[R5]' },
      ...(site.liquefactionProxy === 'higher'
        ? [{ text: 'This location screens as higher liquefaction susceptibility (proxy). Buried gas and water lines are the first casualties of liquefaction; plan on no piped utilities for the full supply horizon.', source: 'proxy screen, see Methods; [R6]' }]
        : []),
    ],
  }

  // ---- Building --------------------------------------------------------------------
  const buildingItems: PlanItem[] = [
    { text: 'Drop, Cover, and Hold On. Do not run outside during shaking.', source: '[R3]' },
    { text: 'Anchor bookcases, TVs and the water heater; move heavy objects to low shelves; keep beds away from windows.', source: '[R3],[R5]' },
  ]
  if (h.homeType === 'mobile') {
    buildingItems.push({
      text: 'Manufactured homes not tied down to a permanent foundation shift or fall off piers in strong shaking. Ask about an engineered tie-down system, and plan to shelter elsewhere after a large event.',
      source: '[R5]',
    })
  }
  if (h.homeType === 'apartment') {
    buildingItems.push({ text: 'Know two ways out of the building. Never use elevators after an earthquake.', source: '[R3]' })
  }
  if (site.mmiLevel >= 7) {
    buildingItems.push({
      text: 'Unreinforced brick chimneys and parapets fail at intensity VII and above. Stay clear of exterior brick walls after shaking stops, and inspect the chimney before using a fireplace.',
      source: '[R7]',
    })
  }
  const building: PlanSection = {
    id: 'building',
    title: h.homeType === 'mobile' ? 'Your manufactured home' : h.homeType === 'apartment' ? 'Your apartment' : 'Your house',
    summary: `Modeled intensity ${romanNumeral(site.mmiLevel)} at this address${site.siteClassIsProxy ? ' (site class estimated from terrain, not measured)' : ''}.`,
    quantities: [],
    items: buildingItems,
  }

  // ---- Communication & meeting points ------------------------------------------------
  const comms: PlanSection = {
    id: 'comms',
    title: 'Find each other',
    summary: 'Cell networks overload or fail after a large earthquake. Decide the plan now.',
    quantities: [],
    items: [
      { text: 'Meeting point 1 — right outside home (a mailbox or a tree), for a sudden emergency such as a fire.', source: '[R2]' },
      { text: 'Meeting point 2 — in the neighborhood (a park, a school), for when you cannot get back to the house.', source: '[R2]' },
      { text: 'Meeting point 3 — outside the neighborhood (a relative’s home or a landmark), for when the area is closed off.', source: '[R2]' },
      { text: 'Choose an out-of-state contact. Everyone texts that person. Long-distance texts get through when local calls do not.', source: '[R2],[R3]' },
      { text: 'Write the contact’s number on paper in every kit and every child’s bag; phones die.', source: '[R2]' },
      ...(h.children > 0
        ? [{ text: 'Learn the school or daycare’s earthquake release policy and who is authorized to pick up your children.', source: '[R2]' }]
        : []),
    ],
  }

  return {
    people,
    supplyDays: days,
    recommendedDays: rec.days,
    recommendedDaysReason: rec.reason,
    sections: [supplies, kit, utilities, building, comms],
  }
}

/** Plain-text export of the plan, for printing or saving offline. */
export function planToText(plan: HouseholdPlan, addressLabel: string): string {
  const lines: string[] = []
  lines.push(`FAULT LINE — HOUSEHOLD EARTHQUAKE PLAN`)
  lines.push(`Location: ${addressLabel}`)
  lines.push(`Supply horizon: ${plan.supplyDays} days (recommended ${plan.recommendedDays})`)
  lines.push('')
  for (const s of plan.sections) {
    lines.push(s.title.toUpperCase())
    lines.push(s.summary)
    for (const q of s.quantities) {
      lines.push(`  • ${q.label}: ${q.value} ${q.unit}   (${q.arithmetic})${q.assumption ? '  [assumption]' : ''}`)
    }
    for (const it of s.items) lines.push(`  • ${it.text}`)
    lines.push('')
  }
  lines.push('This plan is generated from the inputs above using published FEMA / Ready.gov guidance; see Methods for sources.')
  return lines.join('\n')
}

function romanNumeral(level: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(10, Math.max(1, level))]
}
