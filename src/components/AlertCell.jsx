import { useOdds } from '../lib/odds'
import { limitMoney } from '../lib/format'
import { limitRuleBand, limitRuleMinEv } from '../lib/metrics'

// Pinnacle names moneylines 'Syunik Moneyline (3-way)'. Say it the short way.
export function alertLabel(sel) {
  if (!sel) return null
  const m = String(sel).match(/^(.*) Moneyline \((2|3)-way\)$/)
  if (!m) return sel
  if (m[2] === '3') return m[1] === 'Draw' ? 'Draw' : `${m[1]} to win`
  return `${m[1]} moneyline`
}

// The Limit column: Pinnacle's limit on the market when the bet was taken,
// and under it what the soccer limit rule asks at that limit today -- 'needs
// +4.5%' in the higher-EV band, 'skip band' under the skip line. Bets the old
// rule (before 2026-10-06) staked at half are still marked so.
// Tables only show the column once some bet has a limit (migration 009).
export const hasLimits = (rows) => rows.some((r) => r.pin_limit != null)

export function limitNote(r) {
  if (r.limit_tier === 'reduced') return 'Reduced stake (old rule)'
  const band = limitRuleBand(r)
  if (band === 'skip') return 'Skip band'
  if (band === 'higher') return `Needs +${limitRuleMinEv(r)}%`
  return null
}

export function LimitCell({ r }) {
  if (r.pin_limit == null) return <td className="num muted">—</td>
  const note = limitNote(r)
  return (
    <td className="num nowrap">
      {limitMoney(r.pin_limit)}
      {note && <div className="sub">{note}</div>}
    </td>
  )
}

// The alert that triggered a wager, split over two columns:
//   Move  -> what Pinnacle's price did, from what to what, and by how much
//   Alert -> WHICH selection Pinnacle moved on
// That selection is often not the line bet -- the Mise bot takes alternate
// lines (alert Over 3.75, bet Over 3.5) -- which is why it is named. Only the
// bot records alerts, so hand-logged and BetInAsia-only bets show dashes.

// A model bet has no Pinnacle move behind it: the model is the alert. So Move
// shows the model's fair price and Alert the model and the EV it saw.
export function modelNote(r) {
  const who = r.strategy === 'cfb_model' ? 'CFB model' : 'NFL model'
  return r.model_ev_pct != null ? `${who}, ${r.model_ev_pct >= 0 ? '+' : ''}${r.model_ev_pct.toFixed(1)}% EV` : who
}

const hasMove = (r) => r.pin_price_before != null && r.pin_price_after != null

export function MoveCell({ r }) {
  const fmt = useOdds()
  if (r.model_price != null) {
    return <td className="alert-move keep">Fair <span className="nowrap">{fmt(r.model_price)}</span></td>
  }
  if (!hasMove(r)) return <td className="muted">—</td>
  return (
    <td>
      <div className="alert-move keep">
        <span className="nowrap">{fmt(r.pin_price_before)}</span>{' '}
        <span className="nowrap"><span className="arrow" aria-label="dropped to">→</span> {fmt(r.pin_price_after)}</span>
      </div>
      {r.pin_drop_pct != null && <div className="sub">{r.pin_drop_pct.toFixed(1)}%</div>}
    </td>
  )
}

export default function AlertCell({ r }) {
  if (r.model_price != null) return <td className="long">{modelNote(r)}</td>
  if (!hasMove(r)) return <td className="muted">—</td>
  return <td className="long">{alertLabel(r.alert_selection) ?? 'Pinnacle'}</td>
}