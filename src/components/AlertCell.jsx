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

// The alert that triggered a wager: WHICH selection Pinnacle moved on, from
// what price to what, and by how much. That selection is often not the line
// bet -- the Mise bot takes alternate lines (alert Over 3.75, bet Over 3.5) --
// which is why it is named. Only the bot records alerts, so hand-logged and
// BetInAsia-only bets show a dash.

export default function AlertCell({ r }) {
  const fmt = useOdds()
  if (r.pin_price_before == null || r.pin_price_after == null) {
    return <td className="muted">—</td>
  }
  const label = alertLabel(r.alert_selection)
  const drop = r.pin_drop_pct != null ? `${r.pin_drop_pct.toFixed(1)}%` : null
  return (
    <td className="nowrap">
      <div className="alert-move">
        {fmt(r.pin_price_before)} <span className="arrow" aria-label="dropped to">→</span> {fmt(r.pin_price_after)}
      </div>
      <div className="sub">
        {label ? `${label} on Pinnacle` : 'Pinnacle'}{drop && `, ${drop}`}
      </div>
    </td>
  )
}
