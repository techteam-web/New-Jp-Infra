import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'

const BASE = '/images/amenities'
// Order of the tour; `focus` keeps the subject in frame when a tall screen crops the sides.
const AMENITIES = [
  { id: 'club-marvel', name: 'Club Marvel', meta: 'Clubhouse', focus: '50%' },
  { id: 'swimming-pool', name: 'Swimming Pool', meta: 'Leisure', focus: '40%' },
  { id: 'kids-pool', name: "Kids' Pool", meta: 'Family', focus: '45%' },
  { id: 'aqua-gym', name: 'Aqua Gym', meta: 'Wellness', focus: '55%' },
  { id: 'gymnasium', name: 'Gymnasium', meta: 'Fitness', focus: '30%' },
  { id: 'activity-studio', name: 'Activity Studio', meta: 'Lifestyle', focus: '45%' },
  { id: 'butterfly-garden', name: 'Butterfly Garden', meta: 'Nature', focus: '52%' },
]
const pad = (n) => String(n).padStart(2, '0')
const imgSrc = (a) => `${BASE}/${a.id}.webp`

// Full-screen amenities tour. Next / Prev (buttons, arrow keys or swipe) wipe the next
// photograph in over the current one, which drifts away underneath; the caption
// lifts out and the new one rises in.
export default function Amenities({
  index,
  label,
  active,
  onBack,
  items = AMENITIES,
  getImage = imgSrc,
  itemType = 'amenity',
}) {
  const count = items.length
  const rootRef = useRef(null)
  const slidesRef = useRef([])
  const currentRef = useRef(0)
  const tlRef = useRef(null)
  const driftRef = useRef(null)
  const firstRef = useRef(true)
  const [current, setCurrent] = useState(0)

  const slideParts = (i) => {
    const el = slidesRef.current[i]
    return { el, img: el?.querySelector('img'), shade: el?.querySelector('.js-shade') }
  }

  // Slow push-in on whichever photograph is on screen
  const drift = (img) => {
    driftRef.current?.kill()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    driftRef.current = gsap.to(img, { scale: 1, duration: 14, ease: 'none' })
  }

  // First slide on screen, with its drift
  useLayoutEffect(() => {
    const { el, img } = slideParts(0)
    gsap.set(el, { autoAlpha: 1, zIndex: 2 })
    gsap.set(img, { scale: 1.08 })
    drift(img)
    return () => {
      tlRef.current?.kill()
      driftRef.current?.kill()
    }
  }, [])

  // Caption rises in after every change (the page layer handles the first entrance)
  useLayoutEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return undefined
    }
    const lines = rootRef.current.querySelectorAll('.js-cap')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tween = gsap.fromTo(
      lines,
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: reduce ? 0 : 0.9, ease: 'power3.out', stagger: 0.07 },
    )
    return () => tween.kill()
  }, [current])

  const go = async (next, dir) => {
    const from = currentRef.current
    if (next === from) return
    tlRef.current?.progress(1) // finish any transition still running
    currentRef.current = next
    const inn = slideParts(next)
    await inn.img.decode().catch(() => {})
    if (currentRef.current !== next) return // a newer click won while this image decoded

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const out = slideParts(from)
    const T = reduce ? 0 : 1.3
    driftRef.current?.kill()

    gsap.set(out.el, { zIndex: 1 })
    gsap.set(inn.el, {
      zIndex: 2,
      autoAlpha: 1,
      clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)',
    })
    gsap.set(inn.shade, { opacity: 0 })

    tlRef.current = gsap
      .timeline({
        onComplete: () => {
          gsap.set(out.el, { autoAlpha: 0, zIndex: 0 })
          gsap.set(out.img, { xPercent: 0, scale: 1.08 })
          gsap.set(out.shade, { opacity: 0 })
          drift(inn.img)
        },
      })
      .to(rootRef.current.querySelectorAll('.js-cap'), {
        yPercent: -110,
        opacity: 0,
        duration: reduce ? 0 : 0.45,
        ease: 'power3.in',
        stagger: 0.04,
      }, 0)
      .call(() => setCurrent(next), null, reduce ? 0 : 0.5)
      .to(inn.el, { clipPath: 'inset(0% 0% 0% 0%)', duration: T, ease: 'expo.inOut' }, 0)
      .fromTo(
        inn.img,
        { scale: 1.32, xPercent: 10 * dir },
        { scale: 1.08, xPercent: 0, duration: reduce ? 0 : 1.8, ease: 'expo.out' },
        reduce ? 0 : 0.15,
      )
      .to(out.img, { xPercent: -16 * dir, duration: T, ease: 'expo.inOut' }, 0)
      .to(out.shade, { opacity: 0.55, duration: T, ease: 'power2.inOut' }, 0)
  }

  const step = (dir) => go((currentRef.current + dir + count) % count, dir)
  const stepRef = useRef(step)
  useLayoutEffect(() => {
    stepRef.current = step
  })

  // Arrow keys while the page is open
  useEffect(() => {
    if (!active) return undefined
    const onKey = (e) => {
      if (e.key === 'ArrowRight') stepRef.current(1)
      else if (e.key === 'ArrowLeft') stepRef.current(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  // Horizontal swipe on touch screens
  const swipe = useRef(null)
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) step(dx < 0 ? 1 : -1)
  }

  const item = items[current]
  const upNext = items[(current + 1) % count]

  return (
    <section
      ref={rootRef}
      className="relative h-svh w-full touch-pan-y overflow-hidden bg-[#0e0c0a]"
      aria-label={label}
      aria-roledescription="carousel"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipe.current = null
      }}
    >
      {/* Photographs, stacked; only the current one (and the incoming one) is visible */}
      {items.map((a, i) => (
        <div
          key={a.id}
          ref={(el) => {
            slidesRef.current[i] = el
          }}
          className="invisible absolute inset-0 overflow-hidden opacity-0"
          aria-hidden={i !== current}
        >
          <img
            src={getImage(a)}
            alt={a.name}
            width="1920"
            height="1080"
            draggable="false"
            fetchPriority={i === 0 ? 'high' : 'low'}
            className="h-full w-full object-cover select-none"
            style={{ objectPosition: `${a.focus} 50%` }}
          />
          <div className="js-shade absolute inset-0 bg-[#0e0c0a] opacity-0" />
        </div>
      ))}

      {/* Legibility veils */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-48"
        style={{ background: 'linear-gradient(to bottom, rgba(10,7,4,.55), transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[62%]"
        style={{ background: 'linear-gradient(to top, rgba(10,7,4,.82) 0%, rgba(10,7,4,.45) 45%, transparent 100%)' }}
      />

      {/* Header: back + section eyebrow left, counter right */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-[clamp(16px,5vw,72px)] pt-[clamp(20px,4.5svh,44px)]">
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden">
            <button type="button" onClick={onBack} className="js-page-in jp-glass jp-back pointer-events-auto">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
          </div>
          <div className="flex items-center gap-4 overflow-hidden">
            <span className="block h-px w-10 bg-[#e6cfa6]" />
            <span className="js-page-in jp-meta inline-block">
              {pad(index)} — {label}
            </span>
          </div>
        </div>
        <div className="overflow-hidden pt-3">
          <span className="js-page-in jp-meta inline-block tabular-nums" aria-live="polite">
            <span className="text-[#e6cfa6]">{pad(current + 1)}</span>
            <span className="opacity-50"> / {pad(count)}</span>
          </span>
        </div>
      </div>

      {/* Caption + controls, kept clear of the brand credit */}
      <div className="jp-amen-foot absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-x-10 gap-y-7 px-[clamp(16px,5vw,72px)]">
        <div className="min-w-0">
          <div className="overflow-hidden">
            <div className="js-page-in">
              <p className="js-cap jp-meta mb-3 text-[#e6cfa6]">{item.meta}</p>
            </div>
          </div>
          <h2 className="jp-headline jp-amen-title overflow-hidden pb-[0.1em]">
            <span className="js-page-in inline-block">
              <span className="js-cap inline-block">{item.name}</span>
            </span>
          </h2>

          {/* Progress: one segment per amenity, each one jumps there */}
          <div className="pt-5">
            <div className="js-page-in flex items-center gap-1.5" role="group" aria-label={`Choose ${itemType}`}>
              {items.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  className="jp-amen-seg"
                  aria-label={a.name}
                  aria-current={i === current ? 'true' : undefined}
                  onClick={() => go(i, i > currentRef.current ? 1 : -1)}
                >
                  <span />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="js-page-in flex items-center gap-3">
            <button type="button" className="jp-glass jp-amen-btn jp-amen-btn--round" onClick={() => step(-1)} aria-label={`Previous ${itemType}`}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="jp-glass jp-amen-btn jp-amen-next" onClick={() => step(1)} aria-label={`Next: ${upNext.name}`}>
              <img src={getImage(upNext)} alt="" width="240" height="135" className="jp-amen-thumb" draggable="false" />
              <span className="flex flex-col items-start gap-1 text-left">
                <span className="jp-meta text-[10px] opacity-60">Next</span>
                <span className="jp-amen-next-name">{upNext.name}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="jp-amen-arrow">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
