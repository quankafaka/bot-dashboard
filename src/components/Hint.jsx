import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// What the less obvious figures mean, shown when a label is hovered (or
// tapped / focused on a phone or keyboard). One place, so every page that
// shows the figure explains it the same way.
export const GLOSSARY = {
  'Expected yield':
    "What these bets should earn per dollar staked, judged by the closing line: each bet's stake times its CLV, added up, over the total stake. Not the EV when the bet was placed. Bets with no closing price are left out.",
  'Expected profit':
    'Stake times CLV, added up: what these bets should have made at the closing price, before luck. The gap between this and actual profit is variance.',
  'Avg CLV':
    'Closing line value: how much better the price taken was than the closing price, in percent. Averaged with every bet counting the same, whatever its stake. Expected yield is the same thing weighted by stake.',
  'Beat close': 'The share of bets taken at a better price than the closing price.',
  'EV at log':
    'The EV pdropper recorded when the bet was logged, averaged with every bet counting the same. Set it next to Avg CLV to see how much of that edge was still there at the close.',
}

const WIDTH = 300
const GAP = 8

// The label with a dotted underline; the explanation floats over the page
// (a portal, so a scrolling table or a panel's edge never clips it).
export default function Hint({ term, children }) {
  const ref = useRef(null)
  const id = useId()
  const [pos, setPos] = useState(null)
  const text = GLOSSARY[term]

  useEffect(() => {
    if (!pos) return undefined
    const hide = () => setPos(null)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [pos])

  if (!text) return children ?? term

  const show = () => {
    const r = ref.current.getBoundingClientRect()
    const width = Math.min(WIDTH, window.innerWidth - 2 * GAP)
    const left = Math.min(Math.max(GAP, r.left + r.width / 2 - width / 2), window.innerWidth - width - GAP)
    // Below the label, or above it when there is no room underneath.
    const below = r.bottom + 160 < window.innerHeight
    setPos({ left: Math.max(GAP, left), top: below ? r.bottom + 6 : r.top - 6, below, width })
  }

  return (
    <span ref={ref} className="hint" tabIndex={0} aria-describedby={pos ? id : undefined}
      onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)}>
      {children ?? term}
      {pos && createPortal(
        <span role="tooltip" id={id} className={`hint-tip ${pos.below ? '' : 'above'}`}
          style={{ left: pos.left, top: pos.top, width: pos.width }}>
          {text}
        </span>,
        document.body,
      )}
    </span>
  )
}
