import { useEffect, useRef, useState } from 'react'
import type { DistrictGrid } from '../lib/district'
import type { SegmentId } from '../lib/faults'
import type { RenderSpec, WorkerRequest, WorkerResponse } from '../workers/scenario.worker'

export interface ScenarioRaster {
  render: RenderSpec
  mmi: Float32Array
  pgaSiteG: Float32Array
  rjbKm: Float32Array
  maxRjbKm: number
  maxMmi: number
  ms: number
}

/** Owns the scenario worker; recomputes when magnitude or segment changes (debounced). */
export function useScenarioGrid(grid: DistrictGrid | null, magMw: number, segmentId: SegmentId, epsilon: number, render: RenderSpec | null) {
  const workerRef = useRef<Worker | null>(null)
  const readyRef = useRef(false)
  const reqId = useRef(0)
  const [raster, setRaster] = useState<ScenarioRaster | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!grid) return
    const w = new Worker(new URL('../workers/scenario.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = w
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data
      if (m.type === 'ready') { readyRef.current = true; return }
      if (m.id !== reqId.current) return
      setRaster({ render: m.render, mmi: m.mmi, pgaSiteG: m.pgaSiteG, rjbKm: m.rjbKm, maxRjbKm: m.maxRjbKm, maxMmi: m.maxMmi, ms: m.ms })
      setBusy(false)
    }
    const init: WorkerRequest = {
      type: 'init',
      grid: { lat0: grid.lat0, lon0: grid.lon0, stepDeg: grid.stepDeg, rows: grid.rows, cols: grid.cols, vs30: Float32Array.from(grid.vs30) },
    }
    w.postMessage(init)
    return () => { w.terminate(); workerRef.current = null; readyRef.current = false }
  }, [grid])

  useEffect(() => {
    if (!grid || !render || !workerRef.current) return
    const id = ++reqId.current
    setBusy(true)
    const t = setTimeout(() => {
      const req: WorkerRequest = { type: 'compute', id, magMw, segmentId, epsilon, render }
      workerRef.current?.postMessage(req)
    }, 60)
    return () => clearTimeout(t)
  }, [grid, magMw, segmentId, epsilon, render])

  return { raster, busy }
}
