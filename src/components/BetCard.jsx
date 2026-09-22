import { money, pct, when, tone } from '../lib/format'
import { marketLabel, SOURCE_LABEL } from '../lib/metrics'
import { useOdds } from '../lib/odds'
import { alertLabel } from './AlertCell'

const RESULT_LABEL = {
  WIN: 'Won', LOSS: 'Lost', HALF_WIN: 'Half won', HALF_LOSS: 'Half lost', PUSH: 'Push', VOID: 'Void',
}

// One bet on a phone. Everything the table rows show, stacked to fit the
// screen: the game and the outcome on top, the bet and the money under it,
// then the alert and where it came from.
//   mode 'pending'  -> stake at risk, EV at log and now
//   mode 'graded'   -> result and profit, CLV
//   mode 'ungraded' -> why no result is coming, and the ID for the overrides file
export default function BetCard({ r, currency, accountNames, mode }) {
  const fmt = useOdds()
  const account = accountNames[r.account] ?? r.account
  const alert = r.pin_price_before != null && r.pin_price_after != null
  const label = alertLabel(r.alert_selection)

  let right
  if (mode === 'graded') {
    right = (
      <div className="bc-right">
        <span className={`result r-${r.result?.toLowerCase()}`}>{RESULT_LABEL[r.result] ?? r.result}</span>
        <span className={`bc-money ${tone(r.profit)}`}>{money(r.profit, currency, { sign: true })}</span>
      </div>
    )
  } else {
    right = (
      <div className="bc-right">
        <span className="bc-dim">{mode === 'pending' ? 'At risk' : 'Stake'}</span>
        <span className="bc-money">{money(r.stake, currency)}</span>
      </div>
    )
  }

  const facts = [
    `${money(r.stake, currency)} at ${fmt(r.price_filled)}`,
    r.closing_price != null ? `closed ${fmt(r.closing_price)}` : null,
    mode === 'graded' && r.clv_pct != null ? `CLV ${pct(r.clv_pct)}` : null,
    mode !== 'graded' && r.ev_pct_log != null ? `EV ${pct(r.ev_pct_log)}` : null,
    mode === 'pending' && r.current_ev_pct != null ? `now ${pct(r.current_ev_pct)}` : null,
  ].filter(Boolean)

  return (
    <article className="bet-card">
      <div className="bc-head">
        <div className="bc-main">
          <div className="bc-game">{r.home_team} v {r.away_team}</div>
          <div className="bc-bet">
            {r.selection} <span className="bc-dim">{marketLabel(r)}</span>
          </div>
        </div>
        {right}
      </div>
      <div className="bc-facts">{facts.join(', ')}</div>
      {alert && (
        <div className="bc-alert">
          <span className="bc-dim">Alert</span>{' '}
          {label && <>{label} </>}
          <span className="alert-move">{fmt(r.pin_price_before)} → {fmt(r.pin_price_after)}</span>
          {r.pin_drop_pct != null && <span className="bc-dim"> ({r.pin_drop_pct.toFixed(1)}%)</span>}
        </div>
      )}
      <div className="bc-meta">
        {when(mode === 'graded' ? r.placed_at : (r.start_time ?? r.placed_at))}, {r.league}
        {r.home_score != null && `, ended ${r.home_score}–${r.away_score}`}, {account}
        {r.source !== 'bot' && <span className="tag">{SOURCE_LABEL[r.source] ?? r.source}</span>}
        {r.is_freebet && <span className="tag">Free bet</span>}
      </div>
      {mode === 'ungraded' && (
        <div className="bc-meta">
          <span className="tag">{r.ev_pct_log == null ? 'Not in pdropper' : 'pdropper never graded it'}</span>
          <span className="bc-id">{r.wager_id}</span>
        </div>
      )}
    </article>
  )
}
