export interface AppLocation {
  lat: number
  lon: number
  /** Storable, display-safe label (city/state/ZIP or "Dropped pin"); never a street address. */
  label: string
  source: 'address' | 'pin' | 'gps' | 'saved'
}

export type Tab = 'site' | 'scenario' | 'plan' | 'methods'
