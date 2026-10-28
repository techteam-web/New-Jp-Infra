// Fetches a driving route from the project to every pinned place and writes
// src/components/locationRoutes.json. Re-run after moving PROJECT or adding pins:
//   node scripts/fetch-routes.mjs
import { writeFileSync } from 'node:fs'
import { BANDS, PROJECT } from '../src/components/locationData.js'

const OUT = new URL('../src/components/locationRoutes.json', import.meta.url)
const from = PROJECT.lngLat.join(',')
const routes = {}

for (const place of BANDS.flatMap((b) => b.places).filter((p) => p.lngLat)) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from};${place.lngLat.join(',')}?overview=full&geometries=geojson`
  const res = await fetch(url, { headers: { 'User-Agent': 'jp-location-map/1.0' } }).then((r) => r.json())
  const route = res.routes?.[0]
  if (!route) {
    console.warn('no route:', place.name)
    continue
  }
  routes[place.name] = {
    km: +(route.distance / 1000).toFixed(1),
    coords: route.geometry.coordinates.map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]),
  }
  console.log(place.name, routes[place.name].km, 'km')
  await new Promise((r) => setTimeout(r, 300)) // be gentle with the public router
}

writeFileSync(OUT, JSON.stringify(routes))
