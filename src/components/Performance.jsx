import { useMemo, useState } from 'react'
import { DIMENSIONS, ODDS_BAND_AMERICAN, applyFilters, summarize, cumulative, breakdown } from '../lib/metrics'
import { useOddsFormat } from '../lib/odds'
import { money, pct, tone } from '../lib/format'
import ProfitChart from './ProfitChart'
import Filters from './Filters'
import { useIsMobile } from '../lib/useIsMobile'
import { Card } from './Daily'

export default function Performance({ rows, filters, setFilters, currency, accountNames }) {
  const [dim, setDim] = useState('sport')
  const mobile = useIsMobile()
  const { format: oddsFormat } = useOddsFormat()
  const rowLabel = (key) => {
    if (dim === 'account') return accountNames[key] ?? key
    if (dim === 'odds' && oddsFormat === 'american') return ODDS_BAND_AMERICAN[key] ?? key
    return key
  }
  // Before `table`, which uses shownDim. The limit splits only once v_wager_limit (migration 009) has data.
  const hasLimits = rows.some((r) => r.pin_limit != null)
  const limitView = dim === 'limit' || dim === 'limitRule'
  const shownDim = (!hasLimits && limitView) ? 'sport' : dim
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters])
  const s = useMemo(() => summarize(filtered), [filtered])
  const series = useMemo(() => cumulative(filtered), [filtered])
  const table = useMemo(() => breakdown(filtered, shownDim), [filtered, shownDim])
  const multiAccount = new Set(rows.map((r) => r.account)).size > 1
  // 'System' only means something once more than one system has bets here.
  const multiSystem = new Set(rows.map((r) => r.strategy ?? null)).size > 1
  const luck = s.profit - s.expected

  return (
    <>
      <Filters rows={rows} filters={filters} setFilters={setFilters} accountNames={accountNames} />

      <div className="cards">
        <Card label="Profit" value={money(s.profit, currency, { sign: true })} valueTone={tone(s.profit)}
          sub={s.bets ? `${money(Math.abs(luck), currency)} ${luck >= 0 ? 'above' : 'below'} expected` : 'No settled bets'} />
        <Card label="Bets" value={s.bets.toLocaleString('en-CA')}
          sub={`${s.openCount} open, ${money(s.openStake, currency)} at risk`} />
        <Card label="Handle" value={money(s.turnover, currency)} sub="Settled bets only" />
        <Card label="Actual yield" value={pct(s.roi, { digits: 2 })} valueTone={tone(s.roi)}
          sub="Profit over settled handle" />
        <Card label="Expected yield" value={pct(s.expYield, { digits: 2 })} valueTone={tone(s.expYield)}
          sub="What the prices were worth" />
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
            {DIMENSIONS.filter((d) => (d.id !== 'account' || multiAccount)
              && (d.id !== 'strategy' || multiSystem)
              && (!d.needsLimits || hasLimits)).map((d) => (
              <button key={d.id} className={shownDim === d.id ? 'on' : ''} aria-pressed={shownDim === d.id}
                onClick={() => setDim(d.id)}>{d.label}</button>
            ))}
          </div>
        </header>
        {hasLimits && limitView && (
          <p className="muted split-note">
            {shownDim === 'limitRule'
              ? 'Soccer only. Full and reduced stake are bets the rule sized; the "before the rule" rows are older bets, grouped by the band their limit falls in today. The skip band is what the rule now refuses.'
              : "Pinnacle's limit on the bet's market when it was taken. The bot reads it for soccer; pdropper's logged limit covers the rest."}
          </p>
        )}
        {mobile ? (
          <div className="day-list">
            {table.map((g) => (
              <div key={g.key} className="day-row">
                <div>
                  <div className="day-name">{rowLabel(g.key)}</div>
                  <div className="sub">{g.bets} bets, {money(g.turnover, currency)} handle</div>
                </div>
                <div className="day-fig">
                  <div className={`bc-money ${tone(g.profit)}`}>{money(g.profit, currency, { sign: true })}</div>
                  <div className="sub">{pct(g.roi)} actual, {pct(g.expYield)} exp.</div>
                  {g.avgClv != null && (
                    <div className="sub">CLV {pct(g.avgClv)}, {g.beatClose.toFixed(0)}% beat close</div>
                  )}
                </div>
              </div>
            ))}
            {table.length === 0 && <p className="muted pad-s">No settled bets match these filters.</p>}
          </div>
        ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{DIMENSIONS.find((d) => d.id === shownDim).label}</th>
                <th scope="col" className="num">Bets</th>
                <th scope="col" className="num">Handle</th>
                <th scope="col" className="num">Profit</th>
                <th scope="col" className="num">Actual yield</th>
                <th scope="col" className="num">Expected yield</th>
                <th scope="col" className="num">Expected profit</th>
                <th scope="col" className="num">Avg CLV</th>
                <th scope="col" className="num">Beat close</th>
              </tr>
            </thead>
            <tbody>
              {table.map((g) => (
                <tr key={g.key}>
                  <th scope="row">{rowLabel(g.key)}</th>
                  <td className="num">{g.bets}</td>
                  <td className="num">{money(g.turnover, currency)}</td>
                  <td className={`num ${tone(g.profit)}`}>{money(g.profit, currency, { sign: true })}</td>
                  <td className={`num ${tone(g.roi)}`}>{pct(g.roi)}</td>
                  <td className={`num ${tone(g.expYield)}`}>{pct(g.expYield, { digits: 2 })}</td>
                  <td className="num">{money(g.expected, currency, { sign: true })}</td>
                  <td className={`num ${tone(g.avgClv)}`}>{pct(g.avgClv, { digits: 2 })}</td>
                  <td className="num">{g.beatClose == null ? '—' : `${g.beatClose.toFixed(0)}%`}</td>
                </tr>
              ))}
              {table.length === 0 && (
                <tr><td colSpan={9} className="muted">No settled bets match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </>
  )
}

