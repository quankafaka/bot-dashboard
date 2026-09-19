import { useMemo, useState } from 'react'
import { DIMENSIONS, applyFilters, summarize, cumulative, breakdown } from '../lib/metrics'
import { money, pct, tone } from '../lib/format'
import ProfitChart from './ProfitChart'
import Filters from './Filters'
import { Card } from './Daily'

export default function Performance({ rows, filters, setFilters, currency, accountNames }) {
  const [dim, setDim] = useState('sport')
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters])
  const s = useMemo(() => summarize(filtered), [filtered])
  const series = useMemo(() => cumulative(filtered), [filtered])
  const table = useMemo(() => breakdown(filtered, dim), [filtered, dim])
  const multiAccount = new Set(rows.map((r) => r.account)).size > 1
  const luck = s.profit - s.expected

  return (
    <>
      <Filters rows={rows} filters={filters} setFilters={setFilters} accountNames={accountNames} />

      <div className="cards">
        <Card label="Profit" value={money(s.profit, currency, { sign: true })} valueTone={tone(s.profit)}
          sub={s.bets ? `${money(Math.abs(luck), currency)} ${luck >= 0 ? 'above' : 'below'} expected` : 'No settled bets'} />
        <Card label="Bets" value={s.bets.toLocaleString('en-CA')}
          sub={`${s.openCount} open, ${money(s.openStake, currency)} at risk`} />
        <Card label="Turnover" value={money(s.turnover, currency)} sub="Settled bets only" />
        <Card label="Yield" value={pct(s.roi, { digits: 2 })} valueTone={tone(s.roi)}
          sub={`Expected ${pct(s.turnover ? (s.expected / s.turnover) * 100 : null, { digits: 2 })}`} />
        <Card label="Average CLV" value={pct(s.avgClv, { digits: 2 })} valueTone={tone(s.avgClv)}
          sub={s.beatClose != null ? `Beat the close on ${s.beatClose.toFixed(0)}% of bets` : ''} />
      </div>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Profit and bets</h2>
            <p className="muted">Actual against expected profit, one step per settled bet</p>
          </div>
        </header>
        <ProfitChart data={series} currency={currency} />
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Split by</h2>
          <div className="seg" role="group" aria-label="Split by">
            {DIMENSIONS.filter((d) => d.id !== 'account' || multiAccount).map((d) => (
              <button key={d.id} className={dim === d.id ? 'on' : ''} aria-pressed={dim === d.id}
                onClick={() => setDim(d.id)}>{d.label}</button>
            ))}
          </div>
        </header>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{DIMENSIONS.find((d) => d.id === dim).label}</th>
                <th scope="col" className="num">Bets</th>
                <th scope="col" className="num">Turnover</th>
                <th scope="col" className="num">Profit</th>
                <th scope="col" className="num">Yield</th>
                <th scope="col" className="num">Avg CLV</th>
                <th scope="col" className="num">Expected</th>
              </tr>
            </thead>
            <tbody>
              {table.map((g) => (
                <tr key={g.key}>
                  <th scope="row">{dim === 'account' ? (accountNames[g.key] ?? g.key) : g.key}</th>
                  <td className="num">{g.bets}</td>
                  <td className="num">{money(g.turnover, currency)}</td>
                  <td className={`num ${tone(g.profit)}`}>{money(g.profit, currency, { sign: true })}</td>
                  <td className={`num ${tone(g.roi)}`}>{pct(g.roi)}</td>
                  <td className={`num ${tone(g.avgClv)}`}>{pct(g.avgClv, { digits: 2 })}</td>
                  <td className="num">{money(g.expected, currency, { sign: true })}</td>
                </tr>
              ))}
              {table.length === 0 && (
                <tr><td colSpan={7} className="muted">No settled bets match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
