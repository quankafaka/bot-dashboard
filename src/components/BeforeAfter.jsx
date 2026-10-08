import { Fragment, useMemo, useState } from 'react'
import { LIMIT_CHANGES, applyFilters, compareAtCutoff, limitBand } from '../lib/metrics'
import { dayLabel, pct, tone } from '../lib/format'
import { useIsMobile } from '../lib/useIsMobile'

// How each side is split. Pinnacle limit only once v_wager_limit has data.
const SPLITS = [
  { id: 'market', label: 'Market' },
  { id: 'sport', label: 'Sport' },
  { id: 'market_sport', label: 'Market by sport' },
  { id: 'limit', label: 'Pinnacle limit', needsLimits: true },
]

// The site's empty-cell mark, as pct() and money() draw it.
const EMPTY = pct(null)
const points = (x) => (x == null ? EMPTY : `${x > 0 ? '+' : ''}${x.toFixed(2)} pts`)
const beat = (x) => (x == null ? EMPTY : `${x.toFixed(0)}%`)

// Settled bets before a cutoff day against those on or after it. Uses every
// filter on the page except the period: the point is to compare two stretches
// of time, and a 7-day window would leave one side empty.
export default function BeforeAfter({ rows, filters, setFilters }) {
  const [split, setSplit] = useState('market')
  const mobile = useIsMobile()
  const hasLimits = rows.some((r) => r.pin_limit != null)
  const shownSplit = !hasLimits && split === 'limit' ? 'market' : split
  const cutoff = filters.cutoff
  const setCutoff = (d) => d && setFilters((f) => ({ ...f, cutoff: d }))

  const allTime = useMemo(() => applyFilters(rows, { ...filters, period: 'all' }), [rows, filters])
  const cmp = useMemo(() => compareAtCutoff(allTime, cutoff, shownSplit), [allTime, cutoff, shownSplit])
  const splitLabel = SPLITS.find((s) => s.id === shownSplit).label
  // A row keyed by limit band reads better with an empty band named.
  const label = (k) => (shownSplit === 'limit' && k === limitBand(null) ? 'No limit logged' : k)

  const cells = (g) => (
    <>
      <td className="num">{g.before.bets || EMPTY}</td>
      <td className={`num ${tone(g.before.avgClv)}`}>{pct(g.before.avgClv, { digits: 2 })}</td>
      <td className="num">{beat(g.before.beatClose)}</td>
      <td className={`num ${tone(g.before.expYield)}`}>{pct(g.before.expYield, { digits: 2 })}</td>
      <td className="num split-start">{g.after.bets || EMPTY}</td>
      <td className={`num ${tone(g.after.avgClv)}`}>{pct(g.after.avgClv, { digits: 2 })}</td>
      <td className="num">{beat(g.after.beatClose)}</td>
      <td className={`num ${tone(g.after.expYield)}`}>{pct(g.after.expYield, { digits: 2 })}</td>
      <td className={`num split-start ${tone(g.clvChange)}`}>{points(g.clvChange)}</td>
    </>
  )

  const side = (s, word) => (s.bets
    ? `${word}: ${s.bets} bets, CLV ${pct(s.avgClv, { digits: 2 })}, ${beat(s.beatClose)} beat close`
    : `${word}: no bets`)
  const card = (g, name, className = '') => (
    <div key={`${className}${g.key ?? name}`} className={`day-row ${className}`}>
      <div>
        <div className="day-name">{name}</div>
        <div className="sub">{side(g.before, 'Before')}</div>
        <div className="sub">{side(g.after, 'After')}</div>
      </div>
      <div className="day-fig">
        <div className={`bc-money ${tone(g.clvChange)}`}>{points(g.clvChange)}</div>
        <div className="sub">CLV change</div>
      </div>
    </div>
  )

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>CLV before and after</h2>
          <p className="muted">
            Settled bets placed before {dayLabel(cutoff)} against those placed on or after it. All time; the other filters apply.
          </p>
        </div>
        <div className="cmp-controls">
          <div className="seg" role="group" aria-label="Cutoff">
            {LIMIT_CHANGES.map((c) => (
              <button key={c.date} className={cutoff === c.date ? 'on' : ''} aria-pressed={cutoff === c.date}
                title={`Cutoff ${c.date}`} onClick={() => setCutoff(c.date)}>{c.label}</button>
            ))}
          </div>
          <label className="date-pick">
            <span>Cutoff</span>
            <input type="date" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
          </label>
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
                <th scope="colgroup" colSpan={4} className="num split-head">Before {dayLabel(cutoff)}</th>
                <th scope="colgroup" colSpan={4} className="num split-head split-start">From {dayLabel(cutoff)}</th>
                <th scope="col" rowSpan={2} className="num split-start">CLV change</th>
              </tr>
              <tr>
                {['Bets', 'Avg CLV', 'Beat close', 'Expected yield'].map((h) => (
                  <th key={`b${h}`} scope="col" className="num">{h}</th>
                ))}
                {['Bets', 'Avg CLV', 'Beat close', 'Expected yield'].map((h, i) => (
                  <th key={`a${h}`} scope="col" className={`num ${i === 0 ? 'split-start' : ''}`}>{h}</th>
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
                <tr><td colSpan={10} className="muted">No settled bets match these filters.</td></tr>
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
