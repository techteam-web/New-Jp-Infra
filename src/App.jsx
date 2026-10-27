import { useEffect, useState } from 'react'
import CinematicIntro from './components/CinematicIntro'
import BottomNav from './components/BottomNav'
import PageLayer from './components/PageLayer'
import { SECTIONS } from './sections'
import brainwingLogo from './assets/brainwing.webp'

const HOME = SECTIONS[0].id
const PAGE_IDS = new Set(SECTIONS.slice(1).map((s) => s.id))
// Immersive pages hide the navbar; their own Back button returns.
const NO_NAV_PAGES = new Set(['view-360', 'amenities'])
const pageFromHash = () => {
  const id = window.location.hash.slice(1)
  return PAGE_IDS.has(id) ? id : null
}

// The scroll journey ends on the hero frame; from there the site is click-only:
// navbar items open full-screen pages over it, Home (or Back) returns to the hero.
function App() {
  const [atEnd, setAtEnd] = useState(false)
  const [page, setPage] = useState(null)

  // The intro always starts from the top, so drop any stale #page from the URL.
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    const onPop = () => setPage(pageFromHash())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // No scrolling behind an open page
  useEffect(() => {
    document.documentElement.classList.toggle('jp-page-open', Boolean(page))
  }, [page])

  const navigate = (id) => {
    const next = id === HOME ? null : id
    if (next === page) return
    window.history.pushState(null, '', next ? `#${next}` : window.location.pathname)
    setPage(next)
  }

  const navVisible = page ? !NO_NAV_PAGES.has(page) : atEnd

  return (
    <>
      <main>
        <CinematicIntro onEndChange={setAtEnd} />
      </main>
      <PageLayer page={page} onBack={() => window.history.back()} />
      <BottomNav visible={navVisible} active={page ?? HOME} onNavigate={navigate} />
      {/* Brand credit, bottom right on every screen; lifts above the navbar where they'd meet */}
      <img
        src={brainwingLogo}
        alt="Powered by Brainwing Innovations"
        width="420"
        height="112"
        className={`jp-credit ${navVisible ? 'jp-credit--lifted' : ''}`}
      />
    </>
  )
}

export default App
