// Procedural, soft cloud sprites. Painted once into a small canvas and then
// moved/scaled on the GPU, so the "layered fog" costs almost nothing per frame.

const hash = (x, y, s) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t) => t * t * (3 - 2 * t)
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function noise(x, y, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}

function fbm(x, y, seed, octaves) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x, y, seed + i * 17)
    norm += amp
    x *= 2.03
    y *= 2.03
    amp *= 0.5
  }
  return sum / norm
}

/**
 * Paint a soft cloud field into `canvas`.
 * coverage: 0..1 – how much of the sprite is filled with cloud.
 * scale: noise frequency (higher = smaller, busier clouds).
 */
export function paintClouds(canvas, { seed = 1, coverage = 0.5, scale = 3.2, octaves = 5 } = {}) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas
  const img = ctx.createImageData(w, h)
  const lo = 1 - coverage - 0.12
  const hi = 1 - coverage + 0.22

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const u = (px / w) * scale
      const v = (py / h) * scale * (h / w) * 1.6
      // domain-warp for billowy, non-grid-looking shapes
      const wx = fbm(u + 3.7, v + 1.3, seed + 91, 3) * 1.6
      const wy = fbm(u + 8.1, v + 5.9, seed + 53, 3) * 1.6
      const f = fbm(u + wx, v + wy, seed, octaves)
      const alpha = smoothstep(lo, hi, f)

      // edge falloff so the sprite never shows a hard border
      const ex = Math.min(px, w - 1 - px) / (w * 0.22)
      const ey = Math.min(py, h - 1 - py) / (h * 0.22)
      const edge = smoothstep(0, 1, Math.min(1, ex, ey))

      // slightly cool shadows, warm-white highlights
      const light = 0.78 + 0.22 * smoothstep(lo, hi + 0.2, f)
      const i = (py * w + px) * 4
      img.data[i] = 236 + 19 * light
      img.data[i + 1] = 240 + 15 * light
      img.data[i + 2] = 248 + 7 * light
      img.data[i + 3] = alpha * edge * 255
    }
  }
  ctx.putImageData(img, 0, 0)
}
