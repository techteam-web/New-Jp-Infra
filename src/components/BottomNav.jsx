import { useLayoutEffect, useRef } from 'react'
import { SECTIONS } from '../sections'

// Floating section navbar, pinned to the bottom of the viewport. Shown only on the intro's
// final frame and on pages; a gold indicator slides beneath the active item.
export default function BottomNav({ visible, active, onNavigate }) {
  const trackRef = useRef(null)
  const indicatorRef = useRef(null)

  // Slide the indicator under the active item and keep it in view when the bar scrolls (mobile).
  useLayoutEffect(() => {
    const track = trackRef.current
    const bar = indicatorRef.current
    if (!track || !bar) return undefined
    const place = () => {
      const link = track.querySelector(`[data-id="${active}"]`)
      if (!link) return
      bar.style.width = `${link.offsetWidth}px`
      bar.style.transform = `translateX(${link.offsetLeft}px)`
      const target = link.offsetLeft - (track.clientWidth - link.offsetWidth) / 2
      track.scrollTo({ left: target, behavior: 'smooth' })
    }
    place()
    window.addEventListener('resize', place)
    document.fonts?.ready.then(place)
    return () => window.removeEventListener('resize', place)
  }, [active])

  return (
    <nav
      aria-label="Sections"
      aria-hidden={!visible}
      inert={!visible}
      className={`jp-nav fixed inset-x-0 z-50 flex justify-center px-3 transition-[opacity,transform] duration-700 ease-[cubic-bezier(.16,1,.3,1)] ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
    >
      <div className="jp-nav-shell max-w-full rounded-full">
        <div ref={trackRef} className="jp-nav-track relative flex overflow-x-auto px-1.5 py-1.5">
          <span ref={indicatorRef} className="jp-nav-indicator" aria-hidden="true" />
          {SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              data-id={id}
              onClick={(e) => {
                e.preventDefault()
                onNavigate(id)
              }}
              aria-current={active === id ? 'page' : undefined}
              className="jp-nav-link"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  )
}
