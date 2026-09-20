import { useMemo, useState } from 'react'
import { money, pct, odds, when, tone } from '../lib/format'
import { marketLabel, SOURCE_LABEL } from '../lib/metrics'

const PAGE = 100
const RESULT_LABEL = {
  WIN: 'Won', LOSS: 'Lost', HALF_WIN: 'Half won', HALF_LOSS: 'Half lost', PUSH: 'Push', VOID: 'Void',
}

export default function Graded({ rows, currency, accountNames }) {
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)

  const graded = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows
      .filter((r) => r.status === 'graded')
      .filter((r) => !needle || `${r.home_team} ${r.away_team} ${r.league} ${r.selection}`.toLowerCase().includes(needle))
      .sort((a, b) => b.placedMs - a.placedMs)
  }, [rows, q])

  return (
    <section>
      <div className="search">
        <label htmlFor="q">Find a bet</label>
        <input id="q" type="search" placeholder="Team, league or selection" value={q}
          onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} />
        <span className="muted">{graded.length.toLocaleString('en-CA')} settled</span>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Placed</th>
              <th scope="col">Game</th>
              <th scope="col">Bet</th>
              <th scope="col" className="num">Odds</th>
              <th scope="col" className="num">Stake</th>
              <th scope="col" className="num">CLV</th>
              <th scope="col">Result</th>
              <th scope="col" className="num">Profit</th>
              <th scope="col">Account</th>
            </tr>
          </thead>
          <tbody>
            {graded.slice(0, shown).map((r) => (
              <tr key={r.wager_id}>
                <td className="nowrap">{when(r.placed_at)}</td>
                <td>
                  <div>{r.home_team} v {r.away_team}</div>
                  <div className="sub">
                    {r.league}{r.home_score != null && `, ended ${r.home_score}–${r.away_score}`}
                  </div>
                </td>
                <td>
                  <div>{r.selection}</div>
                  <div className="sub">
                    {marketLabel(r)}
                    {r.source !== 'bot' && <span className="tag">{SOURCE_LABEL[r.source] ?? r.source}</span>}
                    {r.is_freebet && <span className="tag">Free bet</span>}
                  </div>
                </td>
                <td className="num">{odds(r.price_filled)}</td>
                <td className="num">{money(r.stake, currency)}</td>
                <td className={`num ${tone(r.clv_pct)}`}>{pct(r.clv_pct)}</td>
                <td><span className={`result r-${r.result?.toLowerCase()}`}>{RESULT_LABEL[r.result] ?? r.result}</span></td>
                <td className={`num ${tone(r.profit)}`}>{money(r.profit, currency, { sign: true })}</td>
                <td>{accountNames[r.account] ?? r.account}</td>
              </tr>
            ))}
            {graded.length === 0 && (
              <tr><td colSpan={9} className="muted">No settled bets match “{q}”.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {graded.length > shown && (
        <button className="more" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, graded.length - shown)} more
        </button>
      )}
    </section>
  )
}
