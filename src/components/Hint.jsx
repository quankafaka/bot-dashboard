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
  // The NFL / CFB tab's "Model price" side: the same four figures, measured
  // against the model's fair price at the time of the bet.
  'Expected yield (model)':
    "What these bets should earn per dollar staked if the model's fair price is right: each bet's stake times its edge over the model price, added up, over the total stake. Before commission.",
  'Expected profit (model)':
    "Stake times the edge over the model's fair price, added up: what these bets should have made if the model is right, before luck and before commission.",
  'Avg CLV (model)':
    "How much better the price taken was than the model's fair price for that bet, in percent, averaged with every bet counting the same. The model price is fixed when the bet is placed, so this is the edge the model saw, not a closing-line test.",
  'Beat close (model)':
    "The share of bets taken at a better price than the model's fair price. Close to 100% by design: the bot only bets when its price beats the model's.",
  // The two per-bet columns on the Pending tab. Both come from pdropper.
  'EV at log, per bet':
    "This bet's EV when pdropper logged it: the price we got, compared with Pinnacle's no-vig line at that moment.",
  'EV now':
    "This bet's EV right now: the price we got, compared with Pinnacle's current no-vig line. Updated at every sync. Higher than EV at log means the line has moved our way since the bet went in.",
  // The same two, for a group of open bets (Overall's Pending tab).
  'EV at log, weighted':
    "The EV pdropper recorded when each bet was logged, averaged with each bet weighted by its stake: a $300 bet counts three times a $100 one. Bets with no EV logged are left out.",
  'EV now, weighted':
    "Each bet's EV against Pinnacle's current no-vig line, averaged with each bet weighted by its stake. Higher than EV at log means the lines have moved our way since the bets went in. Bets with no current price are left out.",
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