import { Fragment, useMemo, useState } from 'react'
import { LIMIT_CUTOFF, applyFilters, compareAtCutoff, limitBand } from '../lib/metrics'
import { dayLabel, money, pct, tone } from '../lib/format'
import { useIsMobile } from '../lib/useIsMobile'
import Hint from './Hint'

// How each side is split. Pinnacle limit only once v_wager_limit has data.
const SPLITS = [
  { id: 'market', label: 'Market' },
  { id: 'sport', label: 'Sport' },
  { id: 'market_sport', label: 'Market by sport' },
  { id: 'limit', label: 'Pinnacle limit', needsLimits: true },
]

// The site's empty-cell mark, as pct() and money() draw it.
const EMPTY = pct(null)
const beat = (x) => (x == null ? EMPTY : `${x.toFixed(0)}%`)

// Settled bets before the higher-EV limit rule (2026-10-06) against those on
// or after it. Uses every filter on the page except the period: the point is
// to compare two stretches of time, and a 7-day window would leave one side
// empty.
export default function BeforeAfter({ rows, filters, currency }) {
  const [split, setSplit] = useState('market')
  const mobile = useIsMobile()
  const hasLimits = rows.some((r) => r.pin_limit != null)
  const shownSplit = !hasLimits && split === 'limit' ? 'market' : split
  const cutoff = LIMIT_CUTOFF

  const allTime = useMemo(() => applyFilters(rows, { ...filters, period: 'all' }), [rows, filters])
  const cmp = useMemo(() => compareAtCutoff(allTime, cutoff, shownSplit), [allTime, cutoff, shownSplit])
  const splitLabel = SPLITS.find((s) => s.id === shownSplit).label
  // A row keyed by limit band reads better with an empty band named.
  const label = (k) => (shownSplit === 'limit' && k === limitBand(null) ? 'No limit logged' : k)

  // One side's cells; the first opens the side with a rule when `edge`.
  const sideCells = (s, edge) => (
    <>
      <td className={`num ${edge ? 'split-start' : ''}`}>{s.bets || EMPTY}</td>
      <td className={`num ${tone(s.avgEvLog)}`}>{pct(s.avgEvLog, { digits: 2 })}</td>
      <td className={`num ${tone(s.avgClv)}`}>{pct(s.avgClv, { digits: 2 })}</td>
      <td className="num">{beat(s.beatClose)}</td>
      <td className={`num ${tone(s.expYield)}`}>{pct(s.expYield, { digits: 2 })}</td>
      <td className={`num ${tone(s.profit)}`}>{s.bets ? money(s.profit, currency, { sign: true }) : EMPTY}</td>
    </>
  )
  const cells = (g) => <>{sideCells(g.before, false)}{sideCells(g.after, true)}</>

  const side = (s, word) => (s.bets ? (
    <>
      <div className="sub"><strong className={tone(s.profit)}>{word}: {s.bets} {s.bets === 1 ? 'bet' : 'bets'}, {money(s.profit, currency, { sign: true })}</strong></div>
      <div className="sub">
        EV {pct(s.avgEvLog, { digits: 2 })}, CLV {pct(s.avgClv, { digits: 2 })}, {beat(s.beatClose)} beat close, exp. {pct(s.expYield, { digits: 2 })}
      </div>
    </>
  ) : <div className="sub">{word}: no bets</div>)
  const card = (g, name, className = '') => (
    <div key={`${className}${g.key ?? name}`} className={`day-row ${className}`}>
      <div>
        <div className="day-name">{name}</div>
        {side(g.before, 'Before')}
        {side(g.after, 'After')}
      </div>
    </div>
  )
  const HEADS = ['Bets', 'EV at log', 'Avg CLV', 'Beat close', 'Expected yield', 'Profit']

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>CLV before and after</h2>
          <p className="muted">
            The higher-EV limit rule started {dayLabel(cutoff)}. Settled bets placed before that day against those placed on or after it. All time; the other filters apply.
          </p>
        </div>
      </header>
      <div className="cmp-split">
        <div className="seg" role="group" aria-label="Compare by">
          {SPLITS.filter((s) => !s.needsLimits || hasLimits).map((s) => (
            <button key={s.id} className={shownSplit === s.id ? 'on' : ''} aria-pressed={shownSplit === s.id}
              onClick={() => setSplit(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      {mobile ? (
        <div className="day-list">
          {cmp.groups.map((g) => (
            <Fragment key={g.key}>
              {card(g, label(g.key), g.children ? 'group' : '')}
              {g.children?.map((c) => card(c, label(c.key), 'child'))}
            </Fragment>
          ))}
          {cmp.groups.length === 0
            ? <p className="muted pad-s">No settled bets match these filters.</p>
            : card(cmp.total, 'All bets', 'total')}
        </div>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>{splitLabel}</th>
                <th scope="colgroup" colSpan={HEADS.length} className="num split-head">Before {dayLabel(cutoff)}</th>
                <th scope="colgroup" colSpan={HEADS.length} className="num split-head split-start">From {dayLabel(cutoff)}</th>
              </tr>
              <tr>
                {HEADS.map((h) => (
                  <th key={`b${h}`} scope="col" className="num"><Hint term={h} /></th>
                ))}
                {HEADS.map((h, i) => (
                  <th key={`a${h}`} scope="col" className={`num ${i === 0 ? 'split-start' : ''}`}><Hint term={h} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmp.groups.map((g) => (
                <Fragment key={g.key}>
                  <tr className={g.children ? 'group' : ''}>
                    <th scope="row">{label(g.key)}</th>
                    {cells(g)}
                  </tr>
                  {g.children?.map((c) => (
                    <tr key={`${g.key}/${c.key}`} className="child">
                      <th scope="row">{label(c.key)}</th>
                      {cells(c)}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {cmp.groups.length === 0 && (
                <tr><td colSpan={1 + 2 * HEADS.length} className="muted">No settled bets match these filters.</td></tr>
              )}
            </tbody>
            {cmp.groups.length > 0 && (
              <tfoot>
                <tr>
                  <th scope="row">All bets</th>
                  {cells(cmp.total)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}
