import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { SECTIONS } from '../sections'
import Pano360 from './Pano360'
import Amenities from './Amenities'

// Built pages by section id; anything not listed shows the placeholder.
const PAGES = {
  'view-360': Pano360,
  amenities: Amenities,
}

// Full-screen page opened from the navbar, layered over the intro's final frame.
// Opens with a bottom-up curtain, closes upward; switching pages swaps the content in place.
export default function PageLayer({ page, onBack }) {
  const layerRef = useRef(null)
  // Keep the last page rendered while the layer animates closed.
  const [shown, setShown] = useState(page)
  if (page && page !== shown) setShown(page)

  // Open / close
  useLayoutEffect(() => {
    const el = layerRef.current
    if (!el) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tween = page
      ? gsap.fromTo(
          el,
          { autoAlpha: 1, clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: reduce ? 0 : 1.1, ease: 'expo.inOut', overwrite: true },
        )
      : gsap.to(el, {
          clipPath: 'inset(0% 0% 100% 0%)',
          duration: reduce ? 0 : 0.9,
          ease: 'expo.inOut',
          overwrite: true,
          onComplete: () => gsap.set(el, { autoAlpha: 0 }),
        })
    if (page) el.scrollTop = 0
    return () => tween.kill()
  }, [page])

  // Content entrance, on open and on every page switch
  useLayoutEffect(() => {
    const el = layerRef.current
    if (!el || !shown || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    el.scrollTop = 0
    const tween = gsap.fromTo(
      el.querySelectorAll('.js-page-in'),
      { opacity: 0, yPercent: 60 },
      { opacity: 1, yPercent: 0, duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.45 },
    )
    return () => tween.kill()
  }, [shown])

  const index = SECTIONS.findIndex((s) => s.id === shown)
  const section = SECTIONS[index]
  const Page = (section && PAGES[section.id]) || PlaceholderPage

  return (
    <div
      ref={layerRef}
      className="jp-no-scrollbar invisible fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-[#0e0c0a] opacity-0"
      role="region"
      aria-label={section?.label}
      aria-hidden={!page}
    >
      {section && <Page key={section.id} index={index + 1} label={section.label} active={page === section.id} onBack={onBack} />}
    </div>
  )
}

// Temporary content until each page is built.
function PlaceholderPage({ index, label }) {
  return (
    <section className="flex min-h-full items-center px-[clamp(20px,6vw,96px)] pt-32 pb-40">
      <div>
        <div className="mb-5 flex items-center gap-4 overflow-hidden">
          <span className="block h-px w-10 bg-[#e6cfa6]" />
          <span className="js-page-in jp-meta inline-block">{String(index).padStart(2, '0')}</span>
        </div>
        <h2 className="jp-headline jp-headline--lg overflow-hidden pb-[0.08em]">
          <span className="js-page-in inline-block">{label}</span>
        </h2>
      </div>
    </section>
  )
}
