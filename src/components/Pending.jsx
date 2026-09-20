import { useMemo } from 'react'
import { money, pct, odds, when, tone } from '../lib/format'
import { marketLabel } from '../lib/metrics'

export default function Pending({ rows, currency, accountNames }) {
  const open = useMemo(() => rows
    .filter((r) => r.status !== 'graded')
    .sort((a, b) => (a.startMs ?? a.placedMs) - (b.startMs ?? b.placedMs)), [rows])
  const unlogged = open.filter((r) => r.status === 'unlogged')
  const stake = open.reduce((a, r) => a + r.stake, 0)

  if (open.length === 0) {
    return <p className="empty-state">Nothing open. New wagers appear here as soon as the bot confirms them.</p>
  }
  return (
    <section>
      <p className="lede">
        {open.length} open, {money(stake, currency)} at risk.
        {unlogged.length > 0 && (
          <> {unlogged.length} {unlogged.length === 1 ? 'game has' : 'games have'} finished but the bet is missing
            from pdropper, so it will never grade. Log {unlogged.length === 1 ? 'it' : 'them'} by hand and run the sync.</>
        )}
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Starts</th>
              <th scope="col">Game</th>
              <th scope="col">Bet</th>
              <th scope="col" className="num">Odds</th>
              <th scope="col" className="num">Stake</th>
              <th scope="col" className="num">EV at log</th>
              <th scope="col" className="num">EV now</th>
              <th scope="col">Account</th>
            </tr>
          </thead>
          <tbody>
            {open.map((r) => (
              <tr key={r.wager_id} className={r.status === 'unlogged' ? 'flag' : ''}>
                <td className="nowrap">{when(r.start_time)}</td>
                <td>
                  <div>{r.home_team} v {r.away_team}</div>
                  <div className="sub">{r.league}</div>
                </td>
                <td>
                  <div>{r.selection}</div>
                  <div className="sub">
                    {marketLabel(r)}{r.status === 'unlogged' && <span className="tag">Not in pdropper</span>}
                  </div>
                </td>
                <td className="num">{odds(r.price_filled)}</td>
                <td className="num">{money(r.stake, currency)}</td>
                <td className={`num ${tone(r.ev_pct_log)}`}>{pct(r.ev_pct_log)}</td>
                <td className={`num ${tone(r.current_ev_pct)}`}>{pct(r.current_ev_pct)}</td>
                <td>{accountNames[r.account] ?? r.account}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
