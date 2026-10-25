import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map as MlMap, Marker, Popup, type CanvasSource, type GeoJSONSource } from 'maplibre-gl'
import { gridBounds, liquefactionScreen, type DistrictGrid } from '../lib/district'
import { segmentsAsGeoJson, type SegmentId } from '../lib/faults'
import type { Quake } from '../lib/seismicity'
import type { ScenarioRaster } from '../hooks/useScenarioGrid'
import { MMI_RAMP, hexToRgb } from '../lib/colors'
import { THEME } from '../lib/theme'
import type { AppLocation } from '../lib/types'

export interface MapLayers { quakes: boolean; liquefaction: boolean; district: boolean }

interface Props {
  grid: DistrictGrid
  raster: ScenarioRaster | null
  location: AppLocation | null
  selectedSegment: SegmentId
  quakes: Quake[]
  layers: MapLayers
  onLayers: (l: MapLayers) => void
  onPick: (lat: number, lon: number) => void
  onSelectSegment: (id: SegmentId) => void
}

/**
 * Basemap: OpenFreeMap "dark" vector style (https://openfreemap.org) — free,
 * keyless, OpenMapTiles schema over OpenStreetMap data. One dark ground so the
 * intensity ramp is the only saturated thing on screen. App layers are inserted
 * beneath the style's first symbol layer, so city labels stay legible above the
 * overlay.
 */
const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'
const OVERLAY_OPACITY = 0.65
/** Scenario field animation: 1.6 s, linear, the only motion in the app. */
const WAVEFRONT_MS = 1600
/** Alpha fades to zero across the outer fraction of the modeled extent, so the
 *  edge of coverage reads as coverage ending rather than as a clipped rectangle. */
const FEATHER = 0.2

export function rasterCorners(grid: DistrictGrid): [[number, number], [number, number], [number, number], [number, number]] {
  const [w, s, e, n] = gridBounds(grid)
  const h = grid.stepDeg / 2
  return [[w - h, n + h], [e + h, n + h], [e + h, s - h], [w - h, s - h]]
}

function firstSymbolLayerId(map: MlMap): string | undefined {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id
}

/** Liquefaction screen as hatching: single 45° for moderate, cross-hatch for higher. */
function liquefactionDataUrl(grid: DistrictGrid): string {
  const px = 12
  const canvas = document.createElement('canvas')
  canvas.width = grid.cols * px; canvas.height = grid.rows * px
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = THEME.textSecondary
  ctx.globalAlpha = 0.75
  ctx.lineWidth = 1
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    const screen = liquefactionScreen(grid.vs30[r * grid.cols + c])
    if (screen === 'lower' || screen === 'unknown') continue
    const x = c * px, y = (grid.rows - 1 - r) * px
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, px, px); ctx.clip()
    ctx.beginPath()
    for (let k = -px; k < px * 2; k += 4) { ctx.moveTo(x + k, y + px); ctx.lineTo(x + k + px, y) }
    if (screen === 'higher') for (let k = -px; k < px * 2; k += 4) { ctx.moveTo(x + k, y); ctx.lineTo(x + k + px, y + px) }
    ctx.stroke(); ctx.restore()
  }
  return canvas.toDataURL('image/png')
}

/**
 * Make the basemap survive being covered by the overlay: thin the road web so it
 * stops competing, and give every label a bright fill over a hard dark halo so
 * place names read through the intensity field rather than under it.
 */
function tuneBasemap(map: MlMap) {
  for (const l of map.getStyle().layers) {
    const sourceLayer = 'source-layer' in l ? l['source-layer'] : undefined
    if (l.type === 'line' && sourceLayer === 'transportation') {
      map.setPaintProperty(l.id, 'line-opacity', 0.28)
    }
    if (l.type === 'symbol') {
      map.setPaintProperty(l.id, 'text-color', THEME.text)
      map.setPaintProperty(l.id, 'text-halo-color', THEME.bg)
      map.setPaintProperty(l.id, 'text-halo-width', 1.8)
      map.setPaintProperty(l.id, 'text-halo-blur', 0.2)
    }
  }
}

function addOverlays(map: MlMap, grid: DistrictGrid, canvas: HTMLCanvasElement) {
  const before = firstSymbolLayerId(map)
  tuneBasemap(map)
  map.addSource('scenario', { type: 'canvas', canvas, coordinates: rasterCorners(grid), animate: false })
  map.addSource('liq', { type: 'image', url: liquefactionDataUrl(grid), coordinates: rasterCorners(grid) })
  map.addSource('district', { type: 'geojson', data: '/data/tn08.geojson' })
  map.addSource('faults', { type: 'geojson', data: segmentsAsGeoJson() })
  map.addSource('quakes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'scenario', type: 'raster', source: 'scenario', paint: { 'raster-opacity': OVERLAY_OPACITY, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, before)
  map.addLayer({ id: 'liq', type: 'raster', source: 'liq', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.8, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }, before)
  map.addLayer({ id: 'district-line', type: 'line', source: 'district', paint: { 'line-color': THEME.textSecondary, 'line-width': 1.2, 'line-dasharray': [4, 3], 'line-opacity': 0.9 } }, before)
  map.addLayer({ id: 'fault-halo', type: 'line', source: 'faults', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': THEME.bg, 'line-width': 6, 'line-opacity': 0.8 } }, before)
  map.addLayer({ id: 'fault-core', type: 'line', source: 'faults', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': THEME.text, 'line-width': 2 } }, before)
  map.addLayer({
    id: 'quakes', type: 'circle', source: 'quakes',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 3, 2, 4, 4, 5, 8, 6, 13],
      'circle-color': 'transparent', 'circle-stroke-color': THEME.textSecondary, 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.8,
    },
  }, before)
}

/**
 * Overlay alpha per MMI band, before feathering.
 *
 * The ramp is monotonic in lightness with dark = intense, which is the right
 * way round on paper but inverts on a dark ground: the strongest bands would
 * recede. Alpha climbs steeply with intensity to compensate, so the peak is the
 * densest part of the image and the far field stays thin enough to read city
 * labels through. Hues are untouched.
 */
const ALPHA_BY_LEVEL = [0, 0, 24, 40, 60, 86, 124, 168, 208, 236, 250]

function fullFrame(r: ScenarioRaster): Uint8ClampedArray {
  const { width, height } = r.render
  const data = new Uint8ClampedArray(width * height * 4)
  const rgb = MMI_RAMP.map((c) => (c ? hexToRgb(c) : null))
  const fw = Math.max(1, FEATHER * width), fh = Math.max(1, FEATHER * height)
  for (let y = 0; y < height; y++) {
    const ey = Math.min(y, height - 1 - y) / fh
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const level = Math.min(10, Math.max(1, Math.round(r.mmi[i])))
      const c = rgb[level - 1]
      if (!c) continue
      const t = Math.min(1, Math.min(ey, Math.min(x, width - 1 - x) / fw))
      const edge = t * t * (3 - 2 * t) // smoothstep
      const o = i * 4
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]
      data[o + 3] = ALPHA_BY_LEVEL[level] * edge
    }
  }
  return data
}

function drawFrame(canvas: HTMLCanvasElement, r: ScenarioRaster, full: Uint8ClampedArray, t: number) {
  const { width, height } = r.render
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(width, height)
  img.data.set(full)
  if (t < 1) {
    const front = t * r.maxRjbKm
    for (let i = 0; i < width * height; i++) if (r.rjbKm[i] > front) img.data[i * 4 + 3] = 0
  }
  ctx.putImageData(img, 0, 0)
}

export function MapView({ grid, raster, location, selectedSegment, quakes, layers, onLayers, onPick, onSelectSegment }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const loadedRef = useRef(false)
  const pickRef = useRef(onPick)
  const selectRef = useRef(onSelectSegment)
  pickRef.current = onPick
  selectRef.current = onSelectSegment
  const [reducedMotion] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [scrub, setScrub] = useState(1)
  const [layersOpen, setLayersOpen] = useState(false)
  const frameRef = useRef<{ raster: ScenarioRaster; full: Uint8ClampedArray } | null>(null)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const [w, s, e, n] = gridBounds(grid)
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE_URL,
      bounds: [[w + 0.3, s + 0.15], [e - 0.3, n - 0.15]],
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
      maxZoom: 14,
      minZoom: 5,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-left')
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left')
    map.on('load', () => { addOverlays(map, grid, canvasRef.current); loadedRef.current = true; applySelection(map, selectedSegment); applyLayers(map, layers) })
    map.on('error', (ev) => { if (ev.error?.name !== 'AbortError') console.error(ev.error) })
    map.on('click', (ev) => {
      const hits = map.queryRenderedFeatures(ev.point, { layers: ['fault-core', 'fault-halo'] })
      if (hits.length) { selectRef.current(hits[0].properties?.id as SegmentId); return }
      pickRef.current(ev.lngLat.lat, ev.lngLat.lng)
    })
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 8 })
    map.on('mouseenter', 'quakes', (ev) => {
      map.getCanvas().style.cursor = 'pointer'
      const f = ev.features?.[0]
      if (!f) return
      const p = f.properties as { mag: number; time: number; place: string; depth: number }
      popup.setLngLat(ev.lngLat).setHTML(`<b>M${Number(p.mag).toFixed(1)}</b> ${new Date(Number(p.time)).getFullYear()}, depth ${Number(p.depth).toFixed(0)} km<br/><span style="color:${THEME.textSecondary}">${p.place}</span>`).addTo(map)
    })
    map.on('mouseleave', 'quakes', () => { map.getCanvas().style.cursor = ''; popup.remove() })
    map.on('mouseenter', 'fault-core', (ev) => {
      map.getCanvas().style.cursor = 'pointer'
      const f = ev.features?.[0]
      if (f) popup.setLngLat(ev.lngLat).setHTML(`<b>${f.properties?.name}</b><br/><span style="color:${THEME.textSecondary}">click to select this source</span>`).addTo(map)
    })
    map.on('mouseleave', 'fault-core', () => { map.getCanvas().style.cursor = ''; popup.remove() })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; loadedRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !raster) return
    frameRef.current = { raster, full: fullFrame(raster) }
    const run = () => {
      const src = map.getSource('scenario') as CanvasSource | undefined
      const f = frameRef.current
      if (!src || !f) return
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
      const finish = () => { setTimeout(() => src.pause(), 120) }
      src.play()
      if (reducedMotion) { drawFrame(canvasRef.current, f.raster, f.full, scrub); setScrub(1); finish(); return }
      const t0 = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / WAVEFRONT_MS)
        drawFrame(canvasRef.current, f.raster, f.full, t)
        if (t < 1) animRef.current = requestAnimationFrame(step)
        else { animRef.current = null; finish() }
      }
      animRef.current = requestAnimationFrame(step)
    }
    if (loadedRef.current) run(); else map.once('load', run)
    return () => { if (animRef.current != null) { cancelAnimationFrame(animRef.current); animRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raster])

  useEffect(() => {
    const map = mapRef.current
    const f = frameRef.current
    if (!map || !f || !reducedMotion || !loadedRef.current) return
    const src = map.getSource('scenario') as CanvasSource | undefined
    if (!src) return
    src.play(); drawFrame(canvasRef.current, f.raster, f.full, scrub); setTimeout(() => src.pause(), 120)
  }, [scrub, reducedMotion])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => applySelection(map, selectedSegment)
    if (loadedRef.current) apply(); else map.once('load', apply)
  }, [selectedSegment])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => applyLayers(map, layers)
    if (loadedRef.current) apply(); else map.once('load', apply)
  }, [layers])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const src = map.getSource('quakes') as GeoJSONSource | undefined
      src?.setData({
        type: 'FeatureCollection',
        features: quakes.map((q) => ({ type: 'Feature', properties: { mag: q.mag, time: q.time, place: q.place, depth: q.depthKm }, geometry: { type: 'Point', coordinates: [q.lon, q.lat] } })),
      })
    }
    if (loadedRef.current) apply(); else map.once('load', apply)
  }, [quakes])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!location) { markerRef.current?.remove(); markerRef.current = null; return }
    if (!markerRef.current) {
      const el = document.createElement('div')
      el.className = 'pin'
      el.innerHTML = '<div class="ring"></div><div class="dot-core"></div>'
      markerRef.current = new Marker({ element: el, anchor: 'center' }).setLngLat([location.lon, location.lat]).addTo(map)
    } else {
      markerRef.current.setLngLat([location.lon, location.lat])
    }
    if (location.source !== 'pin') map.easeTo({ center: [location.lon, location.lat], zoom: Math.max(map.getZoom(), 9.2), duration: 1100 })
  }, [location])

  const recenter = () => {
    const map = mapRef.current
    if (!map) return
    if (location) map.easeTo({ center: [location.lon, location.lat], zoom: Math.max(map.getZoom(), 9.2), duration: 600 })
    else { const [w, s, e, n] = gridBounds(grid); map.fitBounds([[w + 0.3, s + 0.15], [e - 0.3, n - 0.15]], { padding: 24, duration: 600 }) }
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" aria-label="Map of West Tennessee and the New Madrid Seismic Zone" />
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2 no-print">
        <div className="flex flex-col border border-border bg-surface">
          <button className="icon-btn border-0" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">+</button>
          <button className="icon-btn border-0 border-t border-border" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">−</button>
          <button className="icon-btn border-0 border-t border-border" onClick={recenter} aria-label={location ? 'Recenter on my pin' : 'Fit the district'} title={location ? 'Recenter on my pin' : 'Fit the district'}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="7" cy="7" r="1.2" fill="currentColor" /><path d="M7 0v2M7 12v2M0 7h2M12 7h2" stroke="currentColor" strokeWidth="1.4" /></svg>
          </button>
        </div>
        <button className="icon-btn" onClick={() => setLayersOpen((v) => !v)} aria-expanded={layersOpen} aria-label="Layers" title="Layers">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1 13 4.5 7 8 1 4.5z M1 7.5 7 11 13 7.5 M1 10.5 7 14 13 10.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
        </button>
        {layersOpen && (
          <div className="bg-surface border border-border p-3 w-[min(80vw,250px)]">
            <div className="text-meta text-fg-secondary mb-2">Layers</div>
            {([['quakes', 'Earthquakes M≥3 since 1974'], ['liquefaction', 'Liquefaction screen'], ['district', 'TN-08 boundary']] as Array<[keyof MapLayers, string]>).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 min-h-8 text-label cursor-pointer">
                <input type="checkbox" checked={layers[k]} onChange={(e) => onLayers({ ...layers, [k]: e.target.checked })} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                {label}
              </label>
            ))}
            {reducedMotion && raster && (
              <label className="block mt-2 text-meta text-fg-secondary">Wavefront
                <input type="range" min={0} max={1} step={0.02} value={scrub} onChange={(e) => setScrub(Number(e.target.value))} className="mag mt-2" aria-label="Scenario wavefront position" />
              </label>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/** Selected source reads brighter; accent is reserved for the user's own pin. */
function applySelection(map: MlMap, selected: SegmentId) {
  if (!map.getLayer('fault-core')) return
  map.setPaintProperty('fault-core', 'line-color', ['case', ['==', ['get', 'id'], selected], THEME.text, THEME.textMuted])
  map.setPaintProperty('fault-core', 'line-width', ['case', ['==', ['get', 'id'], selected], 3, 1.4])
}

function applyLayers(map: MlMap, layers: MapLayers) {
  const vis = (id: string, on: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none') }
  vis('quakes', layers.quakes); vis('liq', layers.liquefaction); vis('district-line', layers.district)
}
