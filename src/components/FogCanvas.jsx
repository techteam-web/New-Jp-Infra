import { useEffect, useRef } from 'react'
import { paintClouds } from '../lib/cloudTexture'

/**
 * One procedural cloud layer. Painted once (off the critical path), then only
 * ever transformed by GSAP. `ref` is forwarded so the timeline can target it.
 */
export default function FogCanvas({ ref, seed, coverage, scale, fit = 'cover', className = '', style }) {
  const local = useRef(null)

  useEffect(() => {
    const canvas = local.current
    if (!canvas) return undefined
    const paint = () => paintClouds(canvas, { seed, coverage, scale })
    const idle = window.requestIdleCallback
    const handle = idle ? idle(paint, { timeout: 600 }) : window.setTimeout(paint, 30)
    return () => (idle ? window.cancelIdleCallback(handle) : window.clearTimeout(handle))
  }, [seed, coverage, scale])

  return (
    <canvas
      ref={(node) => {
        local.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      width={640}
      height={400}
      aria-hidden="true"
      className={`pointer-events-none absolute opacity-0 ${className}`}
      style={{ objectFit: fit, ...style }}
    />
  )
}
