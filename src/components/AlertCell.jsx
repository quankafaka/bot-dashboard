import { useOdds } from '../lib/odds'

// The alert that triggered a wager: Pinnacle's price before and after the
// drop, and how far it fell. Only the bot records it, so hand-logged and
// BetInAsia-only bets show a dash.
export default function AlertCell({ r }) {
  const fmt = useOdds()
  if (r.pin_price_before == null || r.pin_price_after == null) {
    return <td className="muted">—</td>
  }
  return (
    <td className="nowrap">
      <div className="alert-move">
        {fmt(r.pin_price_before)} <span className="arrow" aria-label="dropped to">→</span> {fmt(r.pin_price_after)}
      </div>
      <div className="sub">
        Pinnacle {r.pin_drop_pct != null ? `${r.pin_drop_pct.toFixed(1)}%` : ''}
        {r.closing_price != null && <>, closed {fmt(r.closing_price)}</>}
      </div>
    </td>
  )
}
