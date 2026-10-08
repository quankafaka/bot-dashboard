import { useMemo } from 'react'
import { money, pct, tone, betTime, multiAccount } from '../lib/format'
import { useOdds } from '../lib/odds'
import AlertCell, { LimitCell, hasLimits } from './AlertCell'
import BetCard from './BetCard'
import { useIsMobile } from '../lib/useIsMobile'
import { betLabel } from '../lib/metrics'

// Two lists. PENDING bets are waiting on a result. UNLOGGED bets are not:
// their game finished long ago and no result is coming -- the bet never
// reached pdropper, or pdropper never graded it. They are kept apart so they neither count as money at
// risk nor sit in the pending list forever.
export default function Pending({ rows, currency, accountNames }) {
  // Newest bet first, by when it was placed -- the same order as Graded.
  const byPlaced = (a, b) => b.placedMs - a.placedMs
  const open = useMemo(() => rows.filter((r) => r.status === 'pending').sort(byPlaced), [rows])
  const unlogged = useMemo(() => rows.filter((r) => r.status === 'unlogged').sort(byPlaced), [rows])
  const stake = open.reduce((a, r) => a + r.stake, 0)
  // Decided on the whole book, so both lists below agree.
  const showAccount = multiAccount(rows)

  return (
    <>
      <section>
        {open.length === 0 ? (
          <p className="empty-state">Nothing open. New wagers appear here as soon as the bot confirms them.</p>
        ) : (
          <>
            <p className="lede">{open.length} open, {money(stake, currency)} at risk.</p>
            <BetTable rows={open} currency={currency} accountNames={accountNames} showAccount={showAccount} />
          </>
        )}
      </section>

      {unlogged.length > 0 && (
        <section className="after">
          <h2>Never graded</h2>
          <p className="lede">
            {unlogged.length} {unlogged.length === 1 ? 'bet whose game is' : 'bets whose games are'} over
            with no result coming. Run <code>m_dashboard_sync --ungraded</code> for a ready-to-fill list,
            put the results in dashboard_overrides.csv, and they move to Graded at the next sync.
          </p>
          <BetTable rows={unlogged} currency={currency} accountNames={accountNames} showAccount={showAccount} showId />
        </section>
      )}
    </>
  )
}

function BetTable({ rows, currency, accountNames, showAccount, showId = false }) {
  const fmt = useOdds()
  const mobile = useIsMobile()
  const showLimit = hasLimits(rows)
  if (mobile) {
    return (
      <div className="cards-list">
        {rows.map((r) => (
          <BetCard key={r.wager_id} r={r} currency={currency} accountNames={accountNames} showAccount={showAccount}
            mode={showId ? 'ungraded' : 'pending'} />
        ))}
      </div>
    )
  }
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Placed</th>
            <th scope="col">Game</th>
            <th scope="col">Bet</th>
            <th scope="col">Alert / model</th>
            {showLimit && <th scope="col" className="num">Pinnacle limit</th>}
            <th scope="col" className="num">Odds</th>
            <th scope="col" className="num">Stake</th>
            <th scope="col" className="num">EV at log</th>
            {!showId && <th scope="col" className="num">EV now</th>}
            {showAccount && <th scope="col">Account</th>}
            {showId && <th scope="col">ID</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.wager_id}>
              <td className="nowrap">{betTime(r)}</td>
              <td>
                <div>{r.home_team} v {r.away_team}</div>
                <div className="sub">{r.league}</div>
              </td>
              <td>
                <div>{r.selection}</div>
                <div className="sub">
                  {betLabel(r)}
                  {showId && <span className="tag">{r.ev_pct_log == null ? 'Not in pdropper' : 'pdropper never graded it'}</span>}
                </div>
              </td>
              <AlertCell r={r} />
              {showLimit && <LimitCell r={r} />}
              <td className="num">
                {fmt(r.price_filled)}
                {r.closing_price != null && <div className="sub">closed {fmt(r.closing_price)}</div>}
              </td>
              <td className="num">{money(r.stake, currency)}</td>
              <td className={`num ${tone(r.ev_pct_log)}`}>{pct(r.ev_pct_log)}</td>
              {!showId && <td className={`num ${tone(r.current_ev_pct)}`}>{pct(r.current_ev_pct)}</td>}
              {showAccount && <td>{accountNames[r.account] ?? r.account}</td>}
              {showId && <td className="nowrap sub">{r.wager_id}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
