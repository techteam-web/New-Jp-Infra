import logoUrl from '../assets/logo-endgame.png'

// Project logo. The PNG (black artwork on transparent, trimmed from
// assets/jp logo/Codename Endgame Final Logo.png) is used as a mask, so the logo takes
// the text colour (ivory by default) and reads on the dark, photographic backgrounds.
const RATIO = 360 / 107
export const LOGO_LABEL = 'Codename Endgame — North Garden City'

export default function Logo({ className = '', style }) {
  return (
    <span
      role="img"
      aria-label={LOGO_LABEL}
      className={`jp-logo ${className}`}
      style={{ '--jp-logo': `url("${logoUrl}")`, aspectRatio: RATIO, ...style }}
    />
  )
}
