import { useMemo, useState } from 'react'
import { money, pct, tone, betTime, multiAccount, when, bookZone } from '../lib/format'
import { useOdds } from '../lib/odds'
import AlertCell, { MoveCell, LimitCell, hasLimits } from './AlertCell'
import BetCard from './BetCard'
import Hint from './Hint'
import { useIsMobile, BET_TABLE_QUERY } from '../lib/useIsMobile'
import { betLabel, SOURCE_LABEL } from '../lib/metrics'

const PAGE = 100

// The open bets: still waiting on a result. Newest placed first (patch notes
// 2026-10-05), with the stake at risk and the EV at log next to the EV now.
// status 'unlogged' lists the bets no result is coming for instead (the game
// is over and pdropper never graded them, e.g. a model's alt line Pinnacle
// does not offer): the same table, the stake, no EV now.
export default function Pending({ rows, currency, accountNames, status = 'pending' }) {
  const [q, setQ] = useState('')
  const fmt = useOdds()
  const [shown, setShown] = useState(PAGE)
  const mobile = useIsMobile(BET_TABLE_QUERY)

  const unlogged = status === 'unlogged'
  const noun = unlogged ? 'unlogged' : 'open'
  const showLimit = hasLimits(rows)
  const showAccount = multiAccount(rows)
  const open = useMemo(() => rows.filter((r) => r.status === status), [rows, status])
  const pending = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return open
      .filter((r) => !needle || `${r.home_team} ${r.away_team} ${r.league} ${r.selection}`.toLowerCase().includes(needle))
      .sort((a, b) => b.placedMs - a.placedMs)
  }, [open, q])
  const atRisk = pending.reduce((t, r) => t + (r.stake ?? 0), 0)
  const empty = open.length === 0
    ? (unlogged ? 'No unlogged bets.' : 'No open bets right now.')
    : `No ${noun} bets match “${q}”.`

  return (
    <section>
      <div className="search">
        <label htmlFor={`q-${status}`}>Find a bet</label>
        <input id={`q-${status}`} type="search" placeholder="Team, league or selection" value={q}
          onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} />
        <span className="muted">
          {pending.length.toLocaleString('en-CA')} {noun}, {money(atRisk, currency)} {unlogged ? 'staked' : 'at risk'}
        </span>
      </div>
      {mobile ? (
        <div className="cards-list">
          {pending.slice(0, shown).map((r) => (
            <BetCard key={r.wager_id} r={r} currency={currency} accountNames={accountNames}
              showAccount={showAccount} mode={unlogged ? 'ungraded' : 'pending'} />
          ))}
          {pending.length === 0 && <p className="muted">{empty}</p>}
        </div>
      ) : (
      <div className="scroll fit">
        <table className="fit">
          <thead>
            <tr>
              <th scope="col">Placed</th>
              <th scope="col">Game</th>
              <th scope="col">Bet</th>
              <th scope="col">Move</th>
              <th scope="col">Alert</th>
              {showLimit && <th scope="col" className="num">Pinnacle limit</th>}
              <th scope="col" className="num">Odds</th>
              <th scope="col" className="num">{unlogged ? 'Stake' : 'At risk'}</th>
              <th scope="col" className="num"><Hint term="EV at log, per bet">EV at log</Hint></th>
              {!unlogged && <th scope="col" className="num"><Hint term="EV now">EV now</Hint></th>}
              {showAccount && <th scope="col">Account</th>}
            </tr>
          </thead>
          <tbody>
            {pending.slice(0, shown).map((r) => (
              <tr key={r.wager_id}>
                <td className="keep">{betTime(r)}</td>
                <td className="long">
                  <div>{r.home_team} v {r.away_team}</div>
                  <div className="sub">
                    {r.league}{r.start_time && `, starts ${when(r.start_time, bookZone(r.book))}`}
                  </div>
                </td>
                <td className="long">
                  <div>{r.selection}</div>
                  <div className="sub">
                    {betLabel(r)}
                    {r.source !== 'bot' && <span className="tag">{SOURCE_LABEL[r.source] ?? r.source}</span>}
                    {r.is_freebet && <span className="tag">Free bet</span>}
                  </div>
                </td>
                <MoveCell r={r} />
                <AlertCell r={r} />
                {showLimit && <LimitCell r={r} />}
                <td className="num">{fmt(r.price_filled)}</td>
                <td className="num">{money(r.stake, currency)}</td>
                <td className={`num ${tone(r.ev_pct_log)}`}>{pct(r.ev_pct_log)}</td>
                {!unlogged && <td className={`num ${tone(r.current_ev_pct)}`}>{pct(r.current_ev_pct)}</td>}
                {showAccount && <td>{accountNames[r.account] ?? r.account}</td>}
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={(unlogged ? 8 : 9) + (showLimit ? 1 : 0) + (showAccount ? 1 : 0)} className="muted">{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      {pending.length > shown && (
        <button className="more" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, pending.length - shown)} more
        </button>
      )}
    </section>
  )
}