/// <reference lib="webworker" />
/**
 * scenario.worker.ts — computes the scenario intensity raster off the main
 * thread. It imports the shared pipeline and reimplements nothing (CLAUDE.md,
 * Hard Invariant 1): every pixel goes through scenarioAtSite(), the same
 * function the address readout uses.
 *
 * Render grid: columns are equally spaced in longitude, rows equally spaced in
 * Web-Mercator y, so the resulting image can be draped on the map with a plain
 * four-corner image source without distortion.
 */

import { scenarioAtSite } from '../lib/pipeline'
import { segmentById, rrupToSegmentKm, type SegmentId } from '../lib/faults'
import { distanceToTraceKm } from '../lib/distance'
import { siteClassFromVs30, type SiteClass } from '../lib/siteclass'
import { OUT_OF_GRID_VS30_MS } from '../lib/district'

export interface WorkerGrid {
  lat0: number
  lon0: number
  stepDeg: number
  rows: number
  cols: number
  vs30: Float32Array
}

export interface RenderSpec {
  west: number
  south: number
  east: number
  north: number
  width: number
  height: number
}

export type WorkerRequest =
  | { type: 'init'; grid: WorkerGrid }
  | { type: 'compute'; id: number; magMw: number; segmentId: SegmentId; epsilon: number; render: RenderSpec }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; id: number; render: RenderSpec; mmi: Float32Array; pgaSiteG: Float32Array; rjbKm: Float32Array; maxRjbKm: number; maxMmi: number; ms: number }

const ctx = self as unknown as DedicatedWorkerGlobalScope
let grid: WorkerGrid | null = null

const mercY = (latDeg: number) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360))
const invMercLat = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI

function siteClassAt(lat: number, lon: number): SiteClass {
  if (!grid) return siteClassFromVs30(OUT_OF_GRID_VS30_MS)
  const row = Math.round((lat - grid.lat0) / grid.stepDeg)
  const col = Math.round((lon - grid.lon0) / grid.stepDeg)
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return siteClassFromVs30(OUT_OF_GRID_VS30_MS)
  return siteClassFromVs30(grid.vs30[row * grid.cols + col])
}

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data
  if (msg.type === 'init') {
    grid = msg.grid
    ctx.postMessage({ type: 'ready' } satisfies WorkerResponse)
    return
  }
  const t0 = performance.now()
  const { render, magMw, segmentId, id, epsilon } = msg
  const seg = segmentById(segmentId)
  const n = render.width * render.height
  const mmi = new Float32Array(n)
  const pgaSiteG = new Float32Array(n)
  const rjbKm = new Float32Array(n)
  let maxRjbKm = 0
  const yN = mercY(render.north), yS = mercY(render.south)
  let maxMmi = 0
  for (let r = 0; r < render.height; r++) {
    const lat = invMercLat(yN + ((r + 0.5) / render.height) * (yS - yN))
    for (let c = 0; c < render.width; c++) {
      const lon = render.west + ((c + 0.5) / render.width) * (render.east - render.west)
      const rjb = distanceToTraceKm([lon, lat], seg.trace)
      const rrup = rrupToSegmentKm([lon, lat], seg)
      const res = scenarioAtSite(magMw, rrup, siteClassAt(lat, lon), epsilon)
      const i = r * render.width + c
      mmi[i] = res.mmi
      pgaSiteG[i] = res.amplified.pgaSiteG
      rjbKm[i] = rjb
      if (rjb > maxRjbKm) maxRjbKm = rjb
      if (res.mmi > maxMmi) maxMmi = res.mmi
    }
  }
  const out: WorkerResponse = { type: 'result', id, render, mmi, pgaSiteG, rjbKm, maxRjbKm, maxMmi, ms: performance.now() - t0 }
  ctx.postMessage(out, [mmi.buffer, pgaSiteG.buffer, rjbKm.buffer])
}
