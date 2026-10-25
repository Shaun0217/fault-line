/**
 * faults.ts — New Madrid Seismic Zone rupture-source geometry.
 *
 * Every coordinate below is transcribed verbatim from the source model files of
 * the USGS 2014 National Seismic Hazard Model for the conterminous United
 * States (Petersen, M. D., et al., 2014, Documentation for the 2014 update of
 * the United States national seismic hazard maps: U.S. Geological Survey
 * Open-File Report 2014-1091, https://doi.org/10.3133/ofr20141091), as
 * published in machine-readable form at
 *   https://github.com/usgs/nshm-cous-2014  (retrieved 2026-09-05)
 *   Central & Eastern US/Cluster/SSCn New Madrid.xml   (CEUS-SSC sections)
 *   Central & Eastern US/Fault/USGS New Madrid 500-year.xml (USGS pseudo-faults)
 *
 * The three named sections come from the CEUS Seismic Source Characterization
 * (EPRI/DOE/NRC, 2012, NUREG-2115) as adopted by the 2014 NSHM:
 *   BA-BL  Blytheville Arch – Bootheel Lineament (southwest arm), strike-slip
 *   NMN_S  New Madrid North (northern arm), strike-slip
 *   RFT_L  Reelfoot thrust (central stepover), dip 40° toward the southwest
 *          (Csontos & Van Arsdale 2008); modelled as a dipping plane in distance.ts
 * The "USGS central" trace is the 2014 NSHM central pseudo-fault (weight 0.70
 * among the five parallel traces), representing a rupture of the whole zone.
 *
 * Depth: the source files specify depth="10.0" (top of rupture, km) and
 * width="15.0" (down-dip width, km) for every NMSZ source. Ztor = 10 km is used
 * as-is; Rrup therefore never falls below 10 km, which keeps the GMPE inside its
 * validity range everywhere.
 *
 * Magnitudes: the source files carry magnitude distributions rather than single
 * values. The 1811–1812 analog presets use the USGS Earthquake Hazards Program
 * summary of the sequence (Dec 16 1811 ≈ M7.5, Jan 23 1812 ≈ M7.3,
 * Feb 7 1812 ≈ M7.5; https://www.usgs.gov/programs/earthquake-hazards/science/
 * science-new-madrid-seismic-zone). Those are estimates from historical
 * accounts; published estimates range from about M7.0 to M8.0 (Johnston &
 * Schweig 1996; Hough & Page 2011). The UI says "estimated" wherever they appear.
 *
 * Nothing in this file expresses when an earthquake will happen (CLAUDE.md,
 * Hard Invariant 2).
 */

import { rrupToPlaneKm, type LonLat } from './distance'

export type SegmentId = 'sw-arm' | 'reelfoot' | 'north-arm' | 'usgs-central'

export interface FaultSegment {
  id: SegmentId
  name: string
  shortName: string
  /** Surface-trace vertices, lon/lat, in the order given by the source file. */
  trace: readonly LonLat[]
  /** Depth to top of rupture, km (source file "depth"). */
  ztorKm: number
  /** Down-dip width, km (source file "width"). */
  widthKm: number
  /** Dip in degrees from the source file. */
  dipDeg: number
  /** Compass bearing the plane descends toward; null for vertical planes. Reelfoot: SW (Csontos & Van Arsdale 2008). */
  dipAzimuthDeg: number | null
  mechanism: 'strike-slip' | 'reverse'
  /** Magnitude range carried by the source model for this section. */
  magRange: readonly [min: number, max: number]
  /** Modal magnitude in the source model's distribution. */
  magModal: number
  sourceFile: string
  sourceSectionName: string
  description: string
}

export const NMSZ_SEGMENTS: readonly FaultSegment[] = [
  {
    id: 'reelfoot',
    name: 'Reelfoot fault',
    shortName: 'Reelfoot',
    trace: [
      [-89.89813, 36.5691],
      [-89.59054, 36.56625],
      [-89.43769, 36.46467],
      [-89.41396, 36.33081],
      [-89.34903, 36.22347],
      [-89.3, 36.15],
    ],
    ztorKm: 10,
    widthKm: 15,
    dipDeg: 40,
    dipAzimuthDeg: 225,
    mechanism: 'reverse',
    magRange: [7.1, 7.8],
    magModal: 7.8,
    sourceFile: 'Central & Eastern US/Cluster/SSCn New Madrid.xml',
    sourceSectionName: 'RFT_L Section',
    description:
      'The thrust fault that dammed the Mississippi and formed Reelfoot Lake in February 1812. Closest source to Lake, Obion and Dyer counties.',
  },
  {
    id: 'sw-arm',
    name: 'Southwest arm (Blytheville Arch – Bootheel Lineament)',
    shortName: 'Southwest arm',
    trace: [
      [-90.37367, 35.55509],
      [-90.09724, 35.80379],
      [-89.75166, 36.43141],
      [-89.62092, 36.5653],
    ],
    ztorKm: 10,
    widthKm: 15,
    dipDeg: 90,
    dipAzimuthDeg: null,
    mechanism: 'strike-slip',
    magRange: [6.7, 7.9],
    magModal: 7.6,
    sourceFile: 'Central & Eastern US/Cluster/SSCn New Madrid.xml',
    sourceSectionName: 'BA-BL Section',
    description: 'The long strike-slip arm running from near Marked Tree, Arkansas toward Caruthersville, Missouri. Closest source to Memphis, Tipton and Lauderdale counties.',
  },
  {
    id: 'north-arm',
    name: 'New Madrid North',
    shortName: 'North arm',
    trace: [
      [-89.62092, 36.5653],
      [-89.2882, 36.9946],
    ],
    ztorKm: 10,
    widthKm: 15,
    dipDeg: 90,
    dipAzimuthDeg: null,
    mechanism: 'strike-slip',
    magRange: [6.8, 7.6],
    magModal: 7.5,
    sourceFile: 'Central & Eastern US/Cluster/SSCn New Madrid.xml',
    sourceSectionName: 'NMN_S Section',
    description: 'The northern strike-slip arm toward Cairo, Illinois. Closest source to Weakley and Obion counties after Reelfoot.',
  },
  {
    id: 'usgs-central',
    name: 'Whole-zone rupture (USGS 2014 central trace)',
    shortName: 'Whole zone',
    trace: [
      [-89.07, 37.165],
      [-89.583, 36.687],
      [-89.504, 36.241],
      [-90.614, 35.419],
    ],
    ztorKm: 10,
    widthKm: 15,
    dipDeg: 89,
    dipAzimuthDeg: null,
    mechanism: 'strike-slip',
    magRange: [6.8, 8.0],
    magModal: 7.5,
    sourceFile: 'Central & Eastern US/Fault/USGS New Madrid 500-year.xml',
    sourceSectionName: 'New Madrid central',
    description: 'The USGS pseudo-fault spanning all three arms, used in the national hazard model for a single rupture of the entire zone.',
  },
]

export function segmentById(id: SegmentId): FaultSegment {
  const s = NMSZ_SEGMENTS.find((x) => x.id === id)
  if (!s) throw new Error(`unknown segment ${id}`)
  return s
}

export interface ScenarioPreset {
  id: string
  label: string
  sublabel: string
  segmentId: SegmentId
  magMw: number
  /** Always phrased as an analog of a past event, never as a forecast. */
  note: string
}

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    id: '1811-12-16',
    label: 'Dec 16, 1811 analog',
    sublabel: 'Southwest arm · est. M7.5',
    segmentId: 'sw-arm',
    magMw: 7.5,
    note: 'Magnitude is the USGS estimate for the first principal shock of the 1811–1812 sequence; published estimates range from about M7.0 to M7.9.',
  },
  {
    id: '1812-01-23',
    label: 'Jan 23, 1812 analog',
    sublabel: 'North arm · est. M7.3',
    segmentId: 'north-arm',
    magMw: 7.3,
    note: 'Magnitude is the USGS estimate for the second principal shock; published estimates range from about M7.0 to M7.6.',
  },
  {
    id: '1812-02-07',
    label: 'Feb 7, 1812 analog',
    sublabel: 'Reelfoot fault · est. M7.5',
    segmentId: 'reelfoot',
    magMw: 7.5,
    note: 'Magnitude is the USGS estimate for the third principal shock, which formed Reelfoot Lake; published estimates range from about M7.0 to M8.0.',
  },
  {
    id: 'moderate',
    label: 'Moderate event',
    sublabel: 'Reelfoot fault · M6.5',
    segmentId: 'reelfoot',
    magMw: 6.5,
    note: 'A magnitude similar to the largest instrumentally recorded central-US earthquakes of the past century.',
  },
]

/** Slider bounds for the scenario magnitude; kept inside the GMPE validity range. */
export const SCENARIO_MAG_MIN = 5.5
export const SCENARIO_MAG_MAX = 8.0

/** GeoJSON for map rendering. */
export function segmentsAsGeoJson(): GeoJSON.FeatureCollection<GeoJSON.LineString, { id: SegmentId; name: string; mechanism: string }> {
  return {
    type: 'FeatureCollection',
    features: NMSZ_SEGMENTS.map((s) => ({
      type: 'Feature',
      properties: { id: s.id, name: s.name, mechanism: s.mechanism },
      geometry: { type: 'LineString', coordinates: s.trace.map((p) => [p[0], p[1]]) },
    })),
  }
}

/** Rupture distance from a site to a segment's finite rupture plane, km. */
export function rrupToSegmentKm(site: LonLat, seg: FaultSegment): number {
  return rrupToPlaneKm(site, seg.trace, seg.ztorKm, seg.widthKm, seg.dipDeg, seg.dipAzimuthDeg)
}
