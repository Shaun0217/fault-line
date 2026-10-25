/**
 * storage.ts — saved household profiles.
 *
 * Always saves to localStorage so the app works with no account and no network.
 * When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set, the same profile is
 * also synced to Supabase under the signed-in user (schema and RLS policies in
 * supabase/schema.sql). Nothing here is required for any core feature.
 *
 * What is stored: a user-chosen label, coordinates rounded to 3 decimals
 * (~100 m), the derived site profile, and the household inputs. Never the street
 * address (CLAUDE.md, Conventions).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { HouseholdInputs } from './plan'
import type { SiteClass } from './siteclass'

export interface SavedProfile {
  id: string
  label: string
  lat: number
  lon: number
  siteClass: SiteClass
  vs30Ms: number
  household: HouseholdInputs
  updatedAt: string
}

const KEY = 'faultline.profiles.v1'

export function roundCoord(x: number): number {
  return Math.round(x * 1000) / 1000
}

export function loadLocalProfiles(): SavedProfile[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedProfile[]) : []
  } catch { return [] }
}

export function saveLocalProfiles(list: SavedProfile[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private mode etc. */ }
}

export function upsertLocalProfile(p: SavedProfile): SavedProfile[] {
  const list = loadLocalProfiles().filter((x) => x.id !== p.id)
  list.unshift({ ...p, lat: roundCoord(p.lat), lon: roundCoord(p.lon) })
  saveLocalProfiles(list.slice(0, 20))
  return loadLocalProfiles()
}

export function deleteLocalProfile(id: string): SavedProfile[] {
  const list = loadLocalProfiles().filter((x) => x.id !== id)
  saveLocalProfiles(list)
  return list
}

// ---- optional Supabase sync -------------------------------------------------------

let client: SupabaseClient | null | undefined

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  client = url && key ? createClient(url, key) : null
  return client
}

export const supabaseEnabled = () => supabase() !== null

export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  const sb = supabase()
  if (!sb) return { error: 'Sync is not configured on this deployment.' }
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
  return error ? { error: error.message } : {}
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut()
}

export async function currentUserId(): Promise<string | null> {
  const sb = supabase()
  if (!sb) return null
  const { data } = await sb.auth.getUser()
  return data.user?.id ?? null
}

export async function syncProfileToCloud(p: SavedProfile): Promise<{ error?: string }> {
  const sb = supabase()
  if (!sb) return {}
  const uid = await currentUserId()
  if (!uid) return { error: 'Sign in to sync.' }
  const { error } = await sb.from('household_profiles').upsert({
    id: p.id, user_id: uid, label: p.label, lat: roundCoord(p.lat), lon: roundCoord(p.lon),
    site_class: p.siteClass, vs30_ms: p.vs30Ms, household: p.household, updated_at: p.updatedAt,
  })
  return error ? { error: error.message } : {}
}

export async function pullProfilesFromCloud(): Promise<SavedProfile[]> {
  const sb = supabase()
  if (!sb) return []
  const { data, error } = await sb.from('household_profiles').select('*').order('updated_at', { ascending: false })
  if (error || !data) return []
  return data.map((r) => ({
    id: r.id as string, label: r.label as string, lat: r.lat as number, lon: r.lon as number,
    siteClass: r.site_class as SiteClass, vs30Ms: r.vs30_ms as number, household: r.household as HouseholdInputs, updatedAt: r.updated_at as string,
  }))
}
