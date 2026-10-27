import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'

const FETCH_CONCURRENCY = 6
const DECODE_CONCURRENCY = 4
const AHEAD = 6 // frames decoded on each side of the playhead
const KEEP = 10 // decoded frames further away than this are released

const decode = (blob) => {
  if (typeof window.createImageBitmap === 'function') return window.createImageBitmap(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => img.decode().then(() => resolve(img), () => resolve(img))
    img.onerror = reject
    img.src = url
  })
}

/**
 * Scroll-scrubbed image sequence drawn to a <canvas>.
 *
 * Seeking a <video> costs 15–40 ms (spikes > 100 ms) per frame, which shows up as lag
 * and judder. Here every frame is downloaded up front as a compressed blob; only a
 * small window around the playhead is decoded (off the main thread, via
 * createImageBitmap), so each scroll step is a ~1 ms drawImage.
 *
 * Optional `still`: a higher-quality image ({ src, x, y, w, h }, placed in the frame's own
 * pixel space) that is cross-faded over the frames via setStillMix(0..1).
 *
 * Returns a stable controller: { setProgress(p), setStillMix(m) }, both 0..1.
 */
export function useFrameScrub(canvasRef, { count, src, still, onProgress, onReady }) {
  const state = useRef({ progress: 0, mix: 0 })
  const cb = useRef({ onProgress, onReady })

  useEffect(() => {
    cb.current = { onProgress, onReady }
  }, [onProgress, onReady])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d', { alpha: false })
    const s = state.current
    const blobs = new Array(count).fill(null)
    const frames = new Map() // index -> decoded bitmap
    const decoding = new Set()
    const ctrl = new AbortController()
    let disposed = false
    let drawn = -1
    let drawnMix = -1
    let dirty = true
    let readyFired = false
    let stillImg = null
    let stillDone = !still

    // Canvas backing store tracks its CSS size (DPR capped at 2).
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (w && h && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w
        canvas.height = h
        ctx.imageSmoothingQuality = 'high'
        dirty = true
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const draw = (img) => {
      const cw = canvas.width
      const ch = canvas.height
      const iw = img.width
      const ih = img.height
      const k = Math.max(cw / iw, ch / ih) // object-fit: cover
      const ox = (cw - iw * k) / 2
      const oy = (ch - ih * k) / 2
      ctx.drawImage(img, ox, oy, iw * k, ih * k)
      if (stillImg && s.mix > 0) {
        ctx.globalAlpha = s.mix
        ctx.drawImage(stillImg, ox + still.x * k, oy + still.y * k, still.w * k, still.h * k)
        ctx.globalAlpha = 1
      }
    }

    const pump = (center) => {
      // release far frames
      for (const [i, bmp] of frames) {
        if (Math.abs(i - center) > KEEP) {
          bmp.close?.()
          frames.delete(i)
        }
      }
      // decode nearest-first: center, +1, -1, +2, -2 …
      for (let d = 0; d <= AHEAD && decoding.size < DECODE_CONCURRENCY; d++) {
        for (const i of d === 0 ? [center] : [center + d, center - d]) {
          if (i < 0 || i >= count || frames.has(i) || decoding.has(i) || !blobs[i]) continue
          if (decoding.size >= DECODE_CONCURRENCY) break
          decoding.add(i)
          decode(blobs[i])
            .then((bmp) => {
              if (disposed) return bmp.close?.()
              frames.set(i, bmp)
              if (i === center) dirty = true
            })
            .catch(() => {})
            .finally(() => decoding.delete(i))
        }
      }
    }

    const tick = () => {
      const target = Math.round(s.progress * (count - 1))
      pump(target)
      if (target === drawn && s.mix === drawnMix && !dirty) return
      // exact frame if decoded, otherwise the nearest decoded neighbour
      let pick = -1
      for (let d = 0; d <= KEEP; d++) {
        if (frames.has(target - d)) { pick = target - d; break }
        if (frames.has(target + d)) { pick = target + d; break }
      }
      if (pick < 0) return
      draw(frames.get(pick))
      drawn = pick
      drawnMix = s.mix
      dirty = pick !== target
      if (!readyFired && stillDone && blobs.every(Boolean)) {
        readyFired = true
        cb.current.onReady?.()
      }
    }
    gsap.ticker.add(tick)

    // Download every frame (compressed) with bounded concurrency; the still counts as one more.
    const total = count + (still ? 1 : 0)
    let loaded = 0
    let next = 0
    const fetchOne = async (i) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(src(i), { signal: ctrl.signal })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return await res.blob()
        } catch (err) {
          if (ctrl.signal.aborted) throw err
        }
      }
      return null
    }
    const worker = async () => {
      while (next < count && !disposed) {
        const i = next++
        const blob = await fetchOne(i)
        if (disposed) return
        blobs[i] = blob ?? blobs[i - 1] ?? null // a missing frame repeats its neighbour
        loaded++
        cb.current.onProgress?.(loaded / total)
        if (i === 0) dirty = true
      }
    }
    if (still) {
      fetch(still.src, { signal: ctrl.signal })
        .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then(decode)
        .then((img) => {
          if (disposed) return img.close?.()
          stillImg = img
        })
        .catch(() => {}) // without the still, the last frame simply stays
        .finally(() => {
          if (disposed) return
          stillDone = true
          loaded++
          cb.current.onProgress?.(loaded / total)
          dirty = true
        })
    }

    Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker))
      .then(() => {
        // backfill a missing first frame from the next good one
        for (let i = count - 2; i >= 0; i--) blobs[i] ??= blobs[i + 1]
        dirty = true
      })
      .catch(() => {})

    return () => {
      disposed = true
      ctrl.abort()
      ro.disconnect()
      gsap.ticker.remove(tick)
      for (const bmp of frames.values()) bmp.close?.()
      frames.clear()
      stillImg?.close?.()
    }
  }, [canvasRef, count, src, still])

  return useMemo(
    () => ({
      setProgress(p) {
        state.current.progress = Math.min(1, Math.max(0, p))
      },
      setStillMix(m) {
        state.current.mix = Math.min(1, Math.max(0, m))
      },
    }),
    [],
  )
}
