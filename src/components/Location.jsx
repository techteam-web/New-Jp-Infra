import { useEffect, useRef, useState } from 'react'
import * as maptilersdk from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css'
import { BANDS, PROJECT } from './locationData'
import ROUTES from './locationRoutes.json' // driving routes, from scripts/fetch-routes.mjs

maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_KEY

const HOME_VIEW = { center: PROJECT.lngLat, zoom: 15.3, pitch: 60, bearing: -22 }

const km = ([lng1, lat1], [lng2, lat2]) => {
  const r = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}

// The part of a route covered at progress t (0..1), measured by distance so the line travels at an even pace.
const routeUpTo = (coords, lengths, t) => {
  const target = lengths[lengths.length - 1] * t
  let i = 1
  while (i < lengths.length - 1 && lengths[i] < target) i++
  const span = lengths[i] - lengths[i - 1] || 1
  const f = Math.min(1, Math.max(0, (target - lengths[i - 1]) / span))
  const [a, b] = [coords[i - 1], coords[i]]
  return [...coords.slice(0, i), [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]]
}

const cumulative = (coords) => coords.reduce((acc, c, i) => [...acc, i ? acc[i - 1] + km(coords[i - 1], c) : 0], [])

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

// A square footprint of `half` metres either side of a point
const footprint = ([lng, lat], half) => {
  const dLat = half / 111320
  const dLng = half / (111320 * Math.cos((lat * Math.PI) / 180))
  return [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]]
}

const MAJOR = ['motorway', 'trunk', 'primary']

// Roads are clean cream-white ribbons, edged in a warm sand casing.
const ROAD_COLOR = ['match', ['get', 'class'], MAJOR, '#fffaf0', ['secondary', 'tertiary'], '#fdf7ec', '#faf3e6']

// Daylight palette from the site: cream ground (#f6efe3), sand-and-gold city like the hero
// tower, soft blue-grey water, espresso (#0e0c0a) type and accents.
function theme(map) {
  for (const layer of map.getStyle().layers) {
    const { id, type } = layer
    const has = (re) => re.test(id)
    try {
      if (type === 'background') map.setPaintProperty(id, 'background-color', '#f6efe3')
      else if (type === 'fill') {
        if (has(/building|water shadow/i)) map.setLayoutProperty(id, 'visibility', 'none')
        else if (has(/water|ocean|sea|lake/i)) map.setPaintProperty(id, 'fill-color', '#d6dee0')
        else if (has(/wood|forest|grass|park/i)) map.setPaintProperty(id, 'fill-color', '#ede4cc')
        else map.setPaintProperty(id, 'fill-color', '#f3ebdc')
      } else if (type === 'line') {
        if (has(/river|water/i)) map.setPaintProperty(id, 'line-color', '#c9d4d7')
        else if (has(/road|bridge/i) && has(/outline/i) && !has(/tunnel/i)) map.setPaintProperty(id, 'line-color', '#e9dcc4')
        else if (has(/road|bridge/i) && !has(/tunnel/i)) map.setPaintProperty(id, 'line-color', ROAD_COLOR)
        else if (has(/rail/i) && !has(/tunnel/i)) map.setPaintProperty(id, 'line-color', 'rgba(26,19,12,0.22)')
        else map.setLayoutProperty(id, 'visibility', 'none')
      } else if (type === 'symbol') {
        if (has(/poi|housenum|shield|oneway|pathway|pedestrian/i)) map.setLayoutProperty(id, 'visibility', 'none')
        else if (has(/road/i)) {
          map.setPaintProperty(id, 'text-color', 'rgba(26,19,12,0.62)')
          map.setPaintProperty(id, 'text-halo-color', 'rgba(255,250,240,0.95)')
          map.setPaintProperty(id, 'text-halo-width', 1.4)
        } else {
          // area names in wide-tracked capitals
          map.setLayoutProperty(id, 'text-transform', 'uppercase')
          map.setLayoutProperty(id, 'text-letter-spacing', 0.35)
          map.setPaintProperty(id, 'text-color', has(/water|sea|bay|ocean|lake|pond|strait/i) ? '#7b8c90' : 'rgba(26,19,12,0.68)')
          map.setPaintProperty(id, 'text-halo-color', 'rgba(246,239,227,0.9)')
          map.setPaintProperty(id, 'text-halo-width', 1.2)
        }
      } else if (type === 'fill-extrusion') map.setLayoutProperty(id, 'visibility', 'none')
    } catch {
      // a layer without that property: leave it as the base style has it
    }
  }
}

function addGlowAndBuildings(map) {
  const style = map.getStyle()
  const ref = style.layers.find((l) => l['source-layer'] === 'building')
  const source = ref?.source ?? Object.keys(style.sources).find((s) => style.sources[s].type === 'vector')
  if (!source) return
  const firstLabel = style.layers.find((l) => l.type === 'symbol')?.id

  // sand-and-caramel city, the warm stone of the hero tower
  const height = ['coalesce', ['get', 'render_height'], ['get', 'height'], 14]
  map.addLayer(
    {
      id: 'jp-buildings',
      type: 'fill-extrusion',
      source,
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], height, 0, '#efdcb8', 30, '#e6cfa6', 90, '#d9b98a'],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, height],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    firstLabel,
  )

  // the project: a lit golden tower on a pool of light
  map.addSource('jp-project', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { h: 0, top: 0 }, geometry: { type: 'Point', coordinates: PROJECT.lngLat } },
        { type: 'Feature', properties: { base: 0, top: 22 }, geometry: { type: 'Polygon', coordinates: footprint(PROJECT.lngLat, 34) } },
        { type: 'Feature', properties: { base: 22, top: 165 }, geometry: { type: 'Polygon', coordinates: footprint(PROJECT.lngLat, 22) } },
      ],
    },
  })
  map.addLayer({
    id: 'jp-project-pool',
    type: 'circle',
    source: 'jp-project',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': '#d9b98a',
      'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 12, 10, 17, 160],
      'circle-blur': 1,
      'circle-opacity': 0.55,
      'circle-pitch-alignment': 'map',
    },
  })
  map.addLayer({
    id: 'jp-project-tower',
    type: 'fill-extrusion',
    source: 'jp-project',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-extrusion-color': '#fbf6ec',
      'fill-extrusion-height': ['get', 'top'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  })

  map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.32, position: [1.3, 210, 40] })
}

const EMPTY = { type: 'FeatureCollection', features: [] }

// The connecting route: an espresso line (#1a130c) on a cream casing with a soft gold glow,
// led by a glowing head.
function addRoute(map) {
  map.addSource('jp-route', { type: 'geojson', data: EMPTY, lineMetrics: true })
  map.addSource('jp-route-head', { type: 'geojson', data: EMPTY })
  const line = { type: 'line', source: 'jp-route', layout: { 'line-cap': 'round', 'line-join': 'round' } }
  map.addLayer({ ...line, id: 'jp-route-bloom', paint: { 'line-color': '#d9b98a', 'line-width': 22, 'line-blur': 16, 'line-opacity': 0.55 } })
  map.addLayer({ ...line, id: 'jp-route-glow', paint: { 'line-color': '#fffaf0', 'line-width': 8, 'line-opacity': 0.95 } })
  map.addLayer({
    ...line,
    id: 'jp-route',
    paint: {
      'line-width': 3,
      'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#1a130c', 1, '#1a130c'],
    },
  })
  map.addLayer({
    id: 'jp-route-head-glow',
    type: 'circle',
    source: 'jp-route-head',
    paint: { 'circle-color': '#d9b98a', 'circle-radius': 20, 'circle-blur': 1, 'circle-opacity': 0.85 },
  })
  map.addLayer({
    id: 'jp-route-head',
    type: 'circle',
    source: 'jp-route-head',
    paint: { 'circle-color': '#1a130c', 'circle-radius': 5, 'circle-stroke-color': '#fffaf0', 'circle-stroke-width': 2 },
  })
}

// While a route is shown, the rest of the road network steps back so the drive reads clearly.
function focusRoads(map, focused) {
  for (const layer of map.getStyle().layers) {
    if (layer['source-layer'] !== 'road' || layer.type !== 'line' || layer.layout?.visibility === 'none') continue
    map.setPaintProperty(layer.id, 'line-opacity-transition', { duration: 800 })
    map.setPaintProperty(layer.id, 'line-opacity', focused ? 0.55 : 1)
  }
}

const lineData = (coords) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } })
const pointData = (coord) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coord } })

function projectPulse() {
  const el = document.createElement('div')
  el.className = 'jp-loc-pulse'
  el.innerHTML = '<i></i><i></i>'
  return el
}

function placeMarker(name, onPick) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'jp-loc-poi'
  el.setAttribute('aria-label', name)
  el.innerHTML = `<span class="jp-loc-poi-dot"></span><span class="jp-loc-poi-label"></span>`
  el.lastChild.textContent = name
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onPick()
  })
  return el
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isWide = () => window.matchMedia('(min-width: 1024px)').matches
// keep the subject clear of the highlights panel
const viewPadding = () => (isWide() ? { top: 80, bottom: 60, left: 480, right: 80 } : { top: 80, bottom: 330, left: 30, right: 30 })

export default function Location({ index, label, active, onBack }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const orbitRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [bandId, setBandId] = useState(BANDS[0].id)
  const [picked, setPicked] = useState(null)
  const [is3d, setIs3d] = useState(true)
  const missingKey = !import.meta.env.VITE_MAPTILER_KEY
  const band = BANDS.find((b) => b.id === bandId)

  // Map setup, once
  useEffect(() => {
    if (missingKey || !containerRef.current) return undefined
    const map = new maptilersdk.Map({
      container: containerRef.current,
      style: maptilersdk.MapStyle.DATAVIZ.DARK,
      center: PROJECT.lngLat,
      zoom: 11,
      pitch: 0,
      bearing: 0,
      maxPitch: 75,
      terrain: false, // the plain is flat here, and terrain holds back the detailed city tiles
      navigationControl: false,
      geolocateControl: false,
      scaleControl: false,
      fullscreenControl: false,
      terrainControl: false,
      space: false,
      halo: false,
      attributionControl: { compact: true },
      antialias: true,
    })
    mapRef.current = map

    map.on('load', () => {
      theme(map)
      addGlowAndBuildings(map)
      addRoute(map)
      try {
        map.setSky({
          'sky-color': '#f6efe3',
          'horizon-color': '#fbf6ec',
          'fog-color': '#f6efe3',
          'sky-horizon-blend': 0.6,
          'horizon-fog-blend': 0.5,
          'fog-ground-blend': 0.5,
          'atmosphere-blend': 0,
        })
      } catch {
        // older renderer without sky: the vignette overlay carries the depth instead
      }
      new maptilersdk.Marker({ element: projectPulse(), anchor: 'center' }).setLngLat(PROJECT.lngLat).addTo(map)
      setReady(true)
    })

    // Any hands-on interaction stops the slow orbit.
    const stopOrbit = () => {
      orbitRef.current = false
    }
    map.on('mousedown', stopOrbit)
    map.on('touchstart', stopOrbit)
    map.on('wheel', stopOrbit)

    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      const dt = now - last
      last = now
      if (orbitRef.current && !map.isMoving()) map.setBearing(map.getBearing() + dt * 0.003)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      map.remove()
      mapRef.current = null
      markersRef.current = []
    }
  }, [missingKey])

  const flyHome = (opts = {}) => {
    const map = mapRef.current
    if (!map) return
    const reduce = reduceMotion()
    orbitRef.current = false
    map[reduce ? 'jumpTo' : 'flyTo']({ ...HOME_VIEW, padding: viewPadding(), duration: 4200, curve: 1.6, essential: true, ...opts })
    if (!reduce) map.once('moveend', () => (orbitRef.current = true))
  }

  // Cinematic arrival every time the page opens
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    if (!active) {
      orbitRef.current = false
      return
    }
    map.resize()
    map.jumpTo({ center: PROJECT.lngLat, zoom: 11, pitch: 0, bearing: 30 })
    const t = setTimeout(() => {
      setPicked(null)
      setIs3d(true)
      flyHome()
    }, 700)
    return () => clearTimeout(t)
  }, [active, ready])

  // Pins for the selected band
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return undefined
    markersRef.current = band.places.map((place) =>
      place.lngLat
        ? new maptilersdk.Marker({ element: placeMarker(place.name, () => setPicked((p) => (p === place.name ? null : place.name))), anchor: 'bottom' })
            .setLngLat(place.lngLat)
            .addTo(map)
        : null,
    )
    return () => {
      for (const m of markersRef.current) m?.remove()
      markersRef.current = []
    }
  }, [band, ready])

  // Picking a place frames the drive there, then draws the route along the roads from the tower;
  // the place's pin pulses while the line travels and lights up when it arrives.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return undefined
    const route = map.getSource('jp-route')
    const head = map.getSource('jp-route-head')
    route?.setData(EMPTY)
    head?.setData(EMPTY)
    const index = band.places.findIndex((p) => p.name === picked && p.lngLat)
    for (const m of markersRef.current) m?.getElement().classList.remove('is-active', 'is-connecting', 'is-arrived')
    focusRoads(map, index >= 0)
    if (index < 0) return undefined

    const place = band.places[index]
    const pin = markersRef.current[index]?.getElement()
    pin?.classList.add('is-active', 'is-connecting')
    const coords = [PROJECT.lngLat, ...(ROUTES[place.name]?.coords ?? []), place.lngLat]
    const lengths = cumulative(coords)

    orbitRef.current = false
    const bounds = coords.reduce((b, c) => b.extend(c), new maptilersdk.LngLatBounds(PROJECT.lngLat, PROJECT.lngLat))
    const reduce = reduceMotion()
    map.fitBounds(bounds, {
      padding: { ...viewPadding(), top: 160, bottom: viewPadding().bottom + 60 },
      pitch: 55,
      bearing: map.getBearing(),
      duration: reduce ? 0 : 2200,
      maxZoom: 16,
    })

    const arrive = () => {
      route?.setData(lineData(coords))
      head?.setData(EMPTY)
      pin?.classList.replace('is-connecting', 'is-arrived')
    }
    if (reduce) {
      arrive()
      return undefined
    }

    // pace the draw by distance: short hops are quick, longer drives take their time
    const duration = Math.min(4200, 1600 + lengths[lengths.length - 1] * 550)
    let raf = 0
    let start = 0
    const draw = (now) => {
      start ||= now
      const t = Math.min(1, (now - start) / duration)
      if (t >= 1) return arrive()
      const part = routeUpTo(coords, lengths, easeInOut(t))
      route?.setData(lineData(part))
      head?.setData(pointData(part[part.length - 1]))
      raf = requestAnimationFrame(draw)
    }
    const delay = setTimeout(() => (raf = requestAnimationFrame(draw)), 700)
    return () => {
      clearTimeout(delay)
      cancelAnimationFrame(raf)
    }
  }, [picked, band, ready])

  const pickBand = (id) => {
    if (id === bandId) return
    setBandId(id)
    setPicked(null)
    const map = mapRef.current
    const pinned = BANDS.find((b) => b.id === id).places.filter((p) => p.lngLat)
    if (!map || !pinned.length) return
    orbitRef.current = false
    const bounds = pinned.reduce((b, p) => b.extend(p.lngLat), new maptilersdk.LngLatBounds(PROJECT.lngLat, PROJECT.lngLat))
    map.fitBounds(bounds, { padding: viewPadding(), pitch: 55, bearing: map.getBearing(), duration: reduceMotion() ? 0 : 2200, maxZoom: 15.3 })
  }

  const toggle3d = () => {
    const map = mapRef.current
    if (!map) return
    orbitRef.current = false
    map.easeTo({ pitch: is3d ? 0 : 60, bearing: is3d ? 0 : map.getBearing() || -22, duration: reduceMotion() ? 0 : 1400 })
    setIs3d(!is3d)
  }

  const zoom = (by) => mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + by, duration: 500 })

  return (
    <section className="jp-loc relative h-svh w-full overflow-hidden bg-[#f6efe3]" aria-label={label}>
      <div
        ref={containerRef}
        className={`jp-loc-map absolute inset-0 transition-opacity duration-[1600ms] ${ready ? 'opacity-100' : 'opacity-0'}`}
        role="region"
        aria-label="Map of the project and its surroundings"
      />
      <div className="jp-loc-vignette pointer-events-none absolute inset-0" />

      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="jp-meta" style={{ color: '#5a4630', animation: missingKey ? 'none' : 'jp-breathe 1.6s ease-in-out infinite' }}>
            {missingKey ? 'Map key missing — set VITE_MAPTILER_KEY in .env' : 'Charting the neighbourhood'}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute left-[clamp(16px,4vw,64px)] top-[clamp(16px,4svh,40px)] overflow-hidden">
        <button type="button" onClick={onBack} className="js-page-in jp-glass jp-back pointer-events-auto">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      </div>

      {/* Location highlights */}
      <aside className="js-page-in jp-loc-panel" aria-label="Location highlights">
        <div className="jp-loc-panel-eyebrow">
          <span>{String(index).padStart(2, '0')}</span>
          <span className="block h-px w-6 bg-[#e6cfa6]/60" />
          <span className="text-[#e6cfa6]">{PROJECT.name}</span>
        </div>
        <h2 className="jp-loc-panel-title">Location Highlights</h2>

        <div className="jp-loc-tabs" role="tablist" aria-label="Travel time">
          {BANDS.map((b) => (
            <button key={b.id} type="button" role="tab" aria-selected={b.id === bandId} className="jp-loc-tab" onClick={() => pickBand(b.id)}>
              {b.label}
            </button>
          ))}
        </div>

        <ol className="jp-loc-list jp-no-scrollbar" key={bandId}>
          {band.places.map((place, i) => (
            <li key={place.name}>
              <button
                type="button"
                className="jp-loc-item"
                aria-pressed={picked === place.name}
                disabled={!place.lngLat}
                onClick={() => setPicked((p) => (p === place.name ? null : place.name))}
              >
                <span className="jp-loc-item-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="jp-loc-item-name">{place.name}</span>
                <span className="jp-loc-item-km">{place.lngLat ? `${(ROUTES[place.name]?.km ?? km(PROJECT.lngLat, place.lngLat)).toFixed(1)} km` : ''}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {/* Camera controls */}
      <div className="jp-loc-controls">
        <div className="js-page-in jp-glass jp-loc-ctrl-group">
          <button type="button" className="jp-loc-ctrl" onClick={() => zoom(1)} aria-label="Zoom in">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
          <span className="jp-loc-ctrl-rule" />
          <button type="button" className="jp-loc-ctrl" onClick={() => zoom(-1)} aria-label="Zoom out">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
        </div>
        <button type="button" className="js-page-in jp-glass jp-loc-ctrl jp-loc-ctrl--solo" onClick={toggle3d} aria-pressed={is3d} aria-label="Toggle 3D view">
          <span className="jp-loc-ctrl-text">{is3d ? '2D' : '3D'}</span>
        </button>
        <button
          type="button"
          className="js-page-in jp-glass jp-loc-ctrl jp-loc-ctrl--solo"
          onClick={() => {
            setPicked(null)
            setIs3d(true)
            flyHome({ duration: 2600 })
          }}
          aria-label="Return to the project"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="2.2" fill="currentColor" />
            <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.1" />
            <path d="M8 0.8v2M8 13.2v2M0.8 8h2M13.2 8h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </section>
  )
}
