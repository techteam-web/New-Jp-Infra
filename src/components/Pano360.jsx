import { useEffect, useRef, useState } from 'react'
import Marzipano from 'marzipano'
import { PANO_BASE, PANO_FACE_SIZE, PANO_LEVELS, PANO_SCENES } from '../pano/scenes'

const DEG = Math.PI / 180

// Full-screen 360° viewer: drag / swipe to look around, scroll / pinch to zoom.
// Slowly auto-rotates after a few idle seconds; the switcher changes floor.
export default function Pano360({ index, label, onBack }) {
  const viewerRef = useRef(null)
  const scenesRef = useRef([])
  const [current, setCurrent] = useState(0)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    const el = viewerRef.current
    if (!el) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const viewer = new Marzipano.Viewer(el, { controls: { mouseViewMode: 'drag' } })

    scenesRef.current = PANO_SCENES.map((d) => {
      const source = Marzipano.ImageUrlSource.fromString(`${PANO_BASE}/${d.id}/{z}/{f}/{y}/{x}.jpg`, {
        cubeMapPreviewUrl: `${PANO_BASE}/${d.id}/preview.jpg`,
      })
      const geometry = new Marzipano.CubeGeometry(PANO_LEVELS)
      const limiter = Marzipano.RectilinearView.limit.traditional(PANO_FACE_SIZE, 100 * DEG, 120 * DEG)
      const view = new Marzipano.RectilinearView(d.initial, limiter)
      return viewer.createScene({ source, geometry, view, pinFirstLevel: true })
    })
    scenesRef.current[0].switchTo({ transitionDuration: 0 })

    if (!reduce) {
      const drift = Marzipano.autorotate({ yawSpeed: 0.04 }) // turn only; keep the visitor's pitch and zoom
      viewer.setIdleMovement(4000, drift)
    }

    const onFirstTouch = () => setTouched(true)
    el.addEventListener('pointerdown', onFirstTouch, { once: true })
    el.addEventListener('wheel', onFirstTouch, { once: true, passive: true })

    return () => {
      el.removeEventListener('pointerdown', onFirstTouch)
      el.removeEventListener('wheel', onFirstTouch)
      viewer.destroy()
      scenesRef.current = []
    }
  }, [])

  const switchScene = (i) => {
    if (i === current) return
    const scene = scenesRef.current[i]
    if (!scene) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scene.view().setParameters(PANO_SCENES[i].initial)
    scene.switchTo({ transitionDuration: reduce ? 0 : 1100 })
    setCurrent(i)
  }

  const scene = PANO_SCENES[current]

  return (
    <section className="relative h-svh w-full overflow-hidden bg-black" aria-label={label}>
      <div ref={viewerRef} className="jp-pano absolute inset-0" aria-label={`${scene.name} panorama. Drag to look around.`} role="img" />

      {/* legibility veil for the header */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{ background: 'linear-gradient(to bottom, rgba(10,7,4,.62), transparent)' }}
      />

      {/* Header: back + title on the left, floor switcher on the right */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-5 px-[clamp(16px,5vw,72px)] pt-[clamp(16px,4svh,40px)]">
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden">
            <button type="button" onClick={onBack} className="js-page-in jp-glass jp-back pointer-events-auto">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-4 overflow-hidden">
              <span className="block h-px w-10 bg-[#e6cfa6]" />
              <span className="js-page-in jp-meta inline-block">
                {String(index).padStart(2, '0')} — {label}
              </span>
            </div>
            <h2 className="jp-headline overflow-hidden pb-[0.08em]">
              <span key={scene.id} className="js-page-in jp-pano-title inline-block">
                {scene.name}
              </span>
            </h2>
            <p className="js-page-in jp-meta mt-2 [text-shadow:0_1px_10px_rgba(10,7,4,.6)]">{scene.meta}</p>
          </div>
        </div>

        <div className="overflow-hidden">
          <div className="js-page-in jp-glass pointer-events-auto flex rounded-full p-1.5" role="group" aria-label="Choose view">
            {PANO_SCENES.map((d, i) => (
              <button
                key={d.id}
                type="button"
                onClick={() => switchScene(i)}
                aria-pressed={i === current}
                className="jp-pano-tab"
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* First-visit hint */}
      <div
        className={`jp-meta pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center transition-opacity duration-700 ${
          touched ? 'opacity-0' : 'opacity-100'
        }`}
        aria-hidden="true"
      >
        <span className="jp-glass flex items-center gap-3 rounded-full px-5 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Drag to look around
        </span>
      </div>
    </section>
  )
}
