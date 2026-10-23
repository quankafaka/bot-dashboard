import { money, pct, betTime } from '../lib/format'
import { betLabel } from '../lib/metrics'
import { useOdds } from '../lib/odds'

// Shown at once; any more wait behind a 'more' line until these go.
const SHOWN = 3

// A popup on the right for each open bet that just came in, newest on top.
// Each one closes by itself after 15 seconds (the bar along its foot; held
// while the mouse is over it), or with its ×. Clicking it opens that book's
// Pending tab.
export default function NewBets({ bets, books, accountNames, onClose, onClear, onOpen }) {
  if (!bets.length) return null
  const more = bets.length - SHOWN
  return (
    <div className="toasts" aria-live="polite">
      {bets.slice(0, SHOWN).map((r) => (
        <Popup key={r.wager_id} r={r} accountNames={accountNames}
          currency={books.find((b) => b.name === r.book)?.currency ?? 'CAD'}
          onClose={() => onClose(r.wager_id)} onOpen={() => onOpen(r)} />
      ))}
      {more > 0 && (
        <div className="toast-more">
          <span>{more} more new {more === 1 ? 'bet' : 'bets'}</span>
          <button className="btn" onClick={onClear}>Dismiss all</button>
        </div>
      )}
    </div>
  )
}

function Popup({ r, currency, accountNames, onClose, onOpen }) {
  const fmt = useOdds()
  const ev = r.ev_pct_log ?? r.ev_pct_bot
  return (
    <article className="toast" role="status">
      <button className="toast-body" onClick={onOpen} title={`Open ${r.book}'s Pending tab`}>
        <div className="toast-head">
          <span className="toast-tag">New bet</span>
          <span>{r.book}, {accountNames[r.account] ?? r.account}</span>
        </div>
        <div className="toast-game">{r.home_team} v {r.away_team}</div>
        <div>{r.selection} <span className="bc-dim">{betLabel(r)}</span></div>
        <div className="toast-facts">
          {money(r.stake, currency)} at {fmt(r.price_filled)}
          {ev != null && <>, EV <span className={ev > 0 ? 'pos' : ev < 0 ? 'neg' : ''}>{pct(ev)}</span></>}
        </div>
        <div className="toast-meta">Placed {betTime(r)}, {r.league}</div>
      </button>
      <button className="toast-x" onClick={onClose} aria-label="Close">×</button>
      <span className="toast-timer" onAnimationEnd={onClose} />
    </article>
  )
}
