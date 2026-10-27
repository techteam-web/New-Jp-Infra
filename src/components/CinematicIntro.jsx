import { useCallback, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useFrameScrub } from '../hooks/useFrameScrub'
import Logo from './Logo'
import LogoDraw from './LogoDraw'

gsap.registerPlugin(ScrollTrigger)

// Frames of /models/video.mp4 with the repeated first city pass cut out (clouds 0–0.7s
// dissolve into 3.0s onward), full source resolution, WebP. Drawn to a canvas instead of
// seeking a <video>, which lagged. Portrait screens get a 1080×1080 centre crop: same
// sharpness, lighter, since they only show the middle of the frame anyway.
const FRAME_COUNT = 164
const FRAME_SET =
  typeof window !== 'undefined' && window.matchMedia('(max-aspect-ratio: 1/1)').matches ? 'portrait' : 'wide'
const frameSrc = (i) => `/frames/${FRAME_SET}/${String(i).padStart(3, '0')}.webp`

// The sequence ends on the hero render, which is sharper than any video frame. It is the
// same shot: scaled 1.15× and nudged (−2, −1) px it sits exactly on the last frame (measured),
// so the cross-fade resolves detail instead of shifting the picture. Coordinates are in the
// frame set's pixels; the portrait set is a 1080-wide centre crop, i.e. offset by 418 px.
const HERO = '/images/jpinfra-hero.webp'
const STILL = {
  src: HERO,
  x: FRAME_SET === 'portrait' ? -420 : -2,
  y: -1,
  w: 1672 * 1.15,
  h: 941 * 1.15,
}

const WORDMARK = 'JP INFRA'
const VIDEO_END = 10 // timeline units; the footage finishes here
const HERO_IN = 0.7 // then the last frame resolves into the hero render
const TOTAL = 12 // + a short hold on the hero for the closing card

// Captions are timed to the footage (timeline units, 10 = end of clip):
// clouds → city (≈1.3–5.3) → tower crown (≈5.8–7.5) → full tower → street (≈9–10).
const CHAPTERS = [
  { n: '01', eyebrow: 'The city', title: 'Above it all,\nyet at its heart', at: 2.0, until: 4.9 },
  { n: '02', eyebrow: 'The address', title: 'A landmark\ntakes its place', at: 5.6, until: 8.0 },
]
const FINAL = { eyebrow: 'JP INFRA Residences', title: 'Life, elevated.', at: 9.0 }
const STEPS = CHAPTERS.length + 1

// `onEndChange(true)` fires once the scroll reaches the hero frame (and false when
// scrolling back up) — the page shows its navigation only there.
export default function CinematicIntro({ onEndChange }) {
  const rootRef = useRef(null)
  const onEndRef = useRef(onEndChange)
  useEffect(() => {
    onEndRef.current = onEndChange
  }, [onEndChange])
  const canvasRef = useRef(null)
  const gate = useRef({ revealed: false })

  // Opens the intro once the frames are loaded, the logo has drawn AND the visitor
  // has pressed Enter, whichever comes last.
  const tryReveal = useCallback(() => {
    const g = gate.current
    const root = rootRef.current
    if (g.revealed || !g.ready || !g.drawn || !g.entered || !root) return
    g.revealed = true

    const q = gsap.utils.selector(root)
    const unlock = () => {
      document.documentElement.classList.remove('jp-lock')
      ScrollTrigger.refresh()
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // no scroll journey: the composed end frame is shown at once, navigation with it
      const done = () => {
        unlock()
        onEndRef.current?.(true)
      }
      gsap.to(q('.js-loader'), { autoAlpha: 0, duration: 0.6, onComplete: done })
      gsap.set(q('.js-letter, .js-title-rule, .js-cue-in'), { opacity: 1, scaleX: 1 })
      return
    }

    gsap
      .timeline({ onComplete: unlock })
      .to(q('.js-load-inner'), { opacity: 0, y: -10, duration: 0.5, ease: 'power2.in' })
      .to(q('.js-loader'), { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.3, ease: 'expo.inOut' }, '-=0.1')
      .fromTo(q('.js-settle'), { scale: 1.16 }, { scale: 1, duration: 2.8, ease: 'expo.out' }, '<0.2')
      .fromTo(
        q('.js-letter'),
        { opacity: 0, yPercent: 60, filter: 'blur(14px)' },
        { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.8, ease: 'expo.out', stagger: 0.07 },
        '<0.55',
      )
      .fromTo(q('.js-title-rule'), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut' }, '<0.6')
      .fromTo(q('.js-cue-in'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }, '<0.5')
  }, [])

  const onReady = useCallback(() => {
    gate.current.ready = true
    tryReveal()
  }, [tryReveal])

  // Logo drawn: the Enter button appears
  const onDrawn = useCallback(() => {
    gate.current.drawn = true
    const btn = rootRef.current?.querySelector('.js-enter')
    if (btn) gsap.to(btn, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' })
    tryReveal()
  }, [tryReveal])

  // Enter: full screen where the browser allows it (it needs this click), then open the intro.
  // If the footage is still downloading, the button pulses quietly until it's ready.
  const onEnter = useCallback((e) => {
    const g = gate.current
    if (g.entered) return
    g.entered = true
    e.currentTarget.setAttribute('aria-busy', 'true')
    const el = document.documentElement
    const request = el.requestFullscreen || el.webkitRequestFullscreen
    try {
      request?.call(el, { navigationUI: 'hide' })?.catch?.(() => {})
    } catch {
      /* full screen refused or unsupported (iPhone Safari): carry on without it */
    }
    tryReveal()
  }, [tryReveal])

  const scrub = useFrameScrub(canvasRef, { count: FRAME_COUNT, src: frameSrc, still: STILL, onReady })

  // Hold the page at the top, scroll locked, until the visitor enters.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    document.documentElement.classList.add('jp-lock')
    return () => {
      document.documentElement.classList.remove('jp-lock')
    }
  }, [])

  // ScrollTrigger ignores resizes while in full screen, so the pinned intro would keep its
  // pre-full-screen height (a black band below). Re-measure on entering/leaving full screen
  // and on any resize made while in it.
  useEffect(() => {
    const inFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement)
    const refresh = gsap.delayedCall(0.15, () => ScrollTrigger.refresh()).pause()
    const onFullscreenChange = () => refresh.restart(true)
    const onResize = () => inFullscreen() && refresh.restart(true)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    window.addEventListener('resize', onResize)
    return () => {
      refresh.kill()
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Scroll choreography
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    ScrollTrigger.config({ ignoreMobileResize: true })
    ScrollTrigger.clearScrollMemory('manual') // ScrollTrigger keeps its own scroll memory too
    const mm = gsap.matchMedia(root)

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const proxy = { p: 0 }
      const count = root.querySelector('.js-count')
      let step = 1
      let ended = false
      let atEnd = false

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => `+=${window.innerHeight * (window.innerWidth < 768 ? 4.4 : 5.2)}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
        onUpdate() {
          // After the end, ScrollTrigger's resize refresh briefly replays the timeline from
          // 0; the final state must not follow it.
          if (ended) return
          const t = this.time()
          if (t >= VIDEO_END !== atEnd) {
            atEnd = !atEnd
            onEndRef.current?.(atEnd)
          }
          const next = t >= FINAL.at ? STEPS : t >= CHAPTERS[1].at - 0.4 ? 2 : 1
          if (next !== step) {
            step = next
            count.textContent = String(step).padStart(2, '0')
          }
          // One-way journey: once the scrub has settled on the final hero frame, scrolling
          // is locked for good. Only a reload starts the intro again.
          if (!ended && this.progress() >= 0.999) {
            ended = true
            document.documentElement.classList.add('jp-end-lock')
          }
        },
      })
      // If the viewport changes while locked (resize, full screen), stay on the final frame.
      const holdEnd = () => {
        if (ended && tl.scrollTrigger) window.scrollTo(0, tl.scrollTrigger.end)
      }
      ScrollTrigger.addEventListener('refresh', holdEnd)
      tl.set({}, {}, TOTAL)

      // Footage
      tl.to(proxy, { p: 1, duration: VIDEO_END, onUpdate: () => scrub.setProgress(ended ? 1 : proxy.p) }, 0)
      const mix = { m: 0 }
      tl.to(mix, { m: 1, duration: HERO_IN, ease: 'sine.inOut', onUpdate: () => scrub.setStillMix(ended ? 1 : mix.m) }, VIDEO_END)

      // Opening: wordmark lifts away
      tl.to('.js-cue', { opacity: 0, duration: 0.4 }, 0)
      tl.to('.js-title', { yPercent: -40, opacity: 0, duration: 1.7, ease: 'power2.in' }, 0.15)
      tl.to('.js-title-shade', { opacity: 0, duration: 1.7 }, 0.15)
      tl.fromTo('.js-chrome', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.4)
      tl.fromTo('.js-rail-fill', { scaleX: 0 }, { scaleX: 1, duration: TOTAL }, 0)

      // Chapters
      CHAPTERS.forEach((c, i) => {
        const el = `.js-ch-${i}`
        tl.fromTo(
          `${el} .js-line`,
          { opacity: 0, yPercent: 110 },
          { opacity: 1, yPercent: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12 },
          c.at,
        )
        tl.fromTo(`${el} .js-ch-rule`, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.out' }, c.at)
        tl.to(el, { opacity: 0, y: -24, duration: 0.7, ease: 'power2.in' }, c.until)
      })
      tl.fromTo('.js-floor', { opacity: 0.35 }, { opacity: 1, duration: 1.2 }, CHAPTERS[0].at - 0.4)

      // Closing card over the street-level frame
      tl.fromTo(
        '.js-final .js-line',
        { opacity: 0, yPercent: 110 },
        { opacity: 1, yPercent: 0, duration: 1, ease: 'power3.out', stagger: 0.14 },
        FINAL.at,
      )
      tl.fromTo('.js-final .js-ch-rule', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power2.out' }, FINAL.at)

      return () => {
        ScrollTrigger.removeEventListener('refresh', holdEnd)
        document.documentElement.classList.remove('jp-end-lock')
        tl.scrollTrigger?.kill()
        tl.kill()
      }
    })

    // Reduced motion: no pin, no scrub — one composed frame with the closing card.
    mm.add('(prefers-reduced-motion: reduce)', () => {
      scrub.setProgress(1)
      scrub.setStillMix(1)
      gsap.set('.js-title, .js-title-shade, .js-cue', { autoAlpha: 0 })
      gsap.set('.js-chrome, .js-floor, .js-final .js-line', { opacity: 1 })
      gsap.set('.js-final .js-ch-rule, .js-rail-fill', { scaleX: 1 })
    })

    return () => mm.revert()
  }, [scrub])

  return (
    <section ref={rootRef} id="home" aria-label="JP INFRA" className="relative h-svh w-full overflow-hidden bg-[#0e0c0a]">
      {/* Footage — frame sequence scrubbed by scroll */}
      <div className="absolute inset-0">
        <canvas ref={canvasRef} className="js-settle block h-full w-full will-change-transform" aria-hidden="true" />
      </div>

      {/* Grade: warm vignette, legibility floor */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 130% 105% at 50% 45%, transparent 60%, rgba(14,10,6,.38) 100%)' }}
      />
      <div
        className="js-title-shade pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 38% at 50% 50%, rgba(20,14,8,.42), transparent 75%)' }}
      />
      <div
        className="js-floor pointer-events-none absolute inset-x-0 bottom-0 h-[55svh] opacity-35"
        style={{ background: 'linear-gradient(to top, rgba(14,10,6,.78) 0%, rgba(14,10,6,.38) 45%, transparent 100%)' }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[22svh]"
        style={{ background: 'linear-gradient(to bottom, rgba(14,10,6,.45), transparent)' }}
      />

      {/* Persistent chrome: brand + chapter rail */}
      <div className="js-chrome pointer-events-none absolute left-[clamp(20px,5vw,72px)] top-[clamp(20px,4svh,40px)] opacity-0">
        <div className="jp-logo-shadow">
          <Logo className="w-[clamp(112px,9vw,150px)]" />
        </div>
      </div>
      <div className="js-chrome jp-meta pointer-events-none absolute right-[clamp(20px,5vw,72px)] top-[clamp(22px,4svh,42px)] flex items-center gap-3 opacity-0">
        <span className="js-count tabular-nums">01</span>
        <span className="relative block h-px w-16 overflow-hidden bg-white/25 sm:w-24">
          <span className="js-rail-fill absolute inset-0 origin-left bg-[#e6cfa6]" />
        </span>
        <span className="tabular-nums opacity-60">{String(STEPS).padStart(2, '0')}</span>
      </div>

      {/* Scene 1 — wordmark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="js-title flex flex-col items-center will-change-transform">
          <h1 className="jp-wordmark" aria-label={WORDMARK}>
            {WORDMARK.split('').map((ch, i) => (
              <span key={i} className="js-letter inline-block opacity-0" aria-hidden="true">
                {ch === ' ' ? ' ' : ch}
              </span>
            ))}
          </h1>
          <span className="js-title-rule mt-[clamp(18px,3svh,32px)] block h-px w-[clamp(64px,10vw,140px)] origin-center scale-x-0 bg-[#e6cfa6]/80" />
        </div>
      </div>

      <div className="js-cue pointer-events-none absolute inset-x-0 bottom-[clamp(24px,4.5svh,48px)] flex justify-center" aria-hidden="true">
        <div className="js-cue-in flex flex-col items-center gap-3 opacity-0">
          <span className="jp-meta">Scroll to discover</span>
          <span className="jp-cue" />
        </div>
      </div>

      {/* Chapters */}
      {CHAPTERS.map((c, i) => (
        <Caption key={c.n} className={`js-ch-${i}`} eyebrow={`${c.n} — ${c.eyebrow}`} title={c.title} />
      ))}
      <Caption className="js-final" eyebrow={FINAL.eyebrow} title={FINAL.title} large />

      {/* Preloader */}
      <div className="js-loader absolute inset-0 z-10 flex items-center justify-center bg-[#0e0c0a]" style={{ clipPath: 'inset(0% 0% 0% 0%)' }}>
        <div className="js-load-inner flex flex-col items-center gap-6">
          <LogoDraw className="w-[clamp(180px,20vw,250px)] text-[#f6efe3]" onDone={onDrawn} />
          <button type="button" onClick={onEnter} className="js-enter jp-enter invisible mt-4 opacity-0" style={{ transform: 'translateY(10px)' }}>
            Enter
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <noscript>
        <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </noscript>
    </section>
  )
}

function Caption({ className, eyebrow, title, large = false }) {
  return (
    <div
      className={`${className} pointer-events-none absolute left-[clamp(20px,6vw,96px)] right-[clamp(20px,6vw,96px)] bottom-[clamp(116px,17svh,180px)] max-w-[40rem]`}
    >
      <div className="mb-5 flex items-center gap-4 overflow-hidden">
        <span className="js-ch-rule block h-px w-10 origin-left scale-x-0 bg-[#e6cfa6]" />
        <span className="js-line jp-meta inline-block opacity-0">{eyebrow}</span>
      </div>
      <h2 className={large ? 'jp-headline jp-headline--lg' : 'jp-headline'}>
        {title.split('\n').map((line) => (
          <span key={line} className="block overflow-hidden pb-[0.08em]">
            <span className="js-line inline-block opacity-0">{line}</span>
          </span>
        ))}
      </h2>
    </div>
  )
}
