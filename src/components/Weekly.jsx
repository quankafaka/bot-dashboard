import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts'
import { applyFilters, weeks, dayStats, localToday, weekStart, addDays } from '../lib/metrics'
import { money, pct, tone, shortDate } from '../lib/format'
import Filters from './Filters'
import Hint from './Hint'
import { useIsMobile } from '../lib/useIsMobile'

// A book's Weekly tab: its filters (the period too), then every week.
export default function Weekly({ rows, filters, setFilters, currency, accountNames }) {
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters])
  return (
    <Weeks rows={filtered} currency={currency} toolbar={() => (
      <Filters rows={rows} filters={filters} setFilters={setFilters} accountNames={accountNames} />
    )} />
  )
}

const weekLabel = (start) => `${shortDate(start)} – ${shortDate(addDays(start, 6))}`

// Every Monday-to-Sunday week of the rows given, newest first, as Daily's
// days are: handle and bets include open bets, profit and yield settled
// ones only. toolbar() draws the row above (Overall's currency switch).
export function Weeks({ rows, currency, toolbar }) {
  const mobile = useIsMobile()
  const thisWeek = weekStart(localToday())
  const list = useMemo(() => weeks(rows), [rows])
  const total = useMemo(() => dayStats(rows), [rows])
  const chart = useMemo(() => [...list].reverse(), [list])

  const tag = (w) => w.start === thisWeek && <span className="tag">This week</span>

  return (
    <>
      {toolbar(null)}

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Profit by week</h2>
            <p className="muted">Monday to Sunday, bets counted in the week they were placed, Montreal time</p>
          </div>
        </header>
        <div className="chart short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="start" tickFormatter={shortDate} tickLine={false} axisLine={false}
                tick={{ fill: 'var(--muted-2)', fontSize: 12 }} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--muted-2)', fontSize: 12 }}
                tickFormatter={(v) => money(v, currency).replace(/\.00$/, '')} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<WeekTip currency={currency} />} />
              <Bar dataKey="profit" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {chart.map((w) => <Cell key={w.start} fill={w.profit >= 0 ? 'var(--green)' : 'var(--red)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        {mobile ? (
          <div className="day-list">
            {list.map((w) => (
              <div key={w.start} className={`day-row ${w.start === thisWeek ? 'today' : ''}`}>
                <div>
                  <div className="day-name">{weekLabel(w.start)}{tag(w)}</div>
                  <div className="sub">{w.wagers} bets, {money(w.handle, currency)} handle{w.open ? `, ${w.open} open` : ''}</div>
                </div>
                <div className="day-fig">
                  <div className={`bc-money ${tone(w.profit)}`}>{money(w.profit, currency, { sign: true })}</div>
                  <div className="sub">{pct(w.yield)} actual, {pct(w.expYield, { digits: 1 })} exp.</div>
                  {w.clvCount > 0 && (
                    <div className="sub">CLV {pct(w.avgClv, { digits: 1 })}, {pct(w.beatClose, { digits: 0, sign: false })} beat</div>
                  )}
                </div>
              </div>
            ))}
            {list.length === 0 && <p className="muted pad-s">No bets match these filters.</p>}
          </div>
        ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col" className="num">Bets</th>
                <th scope="col" className="num">Handle</th>
                <th scope="col" className="num">Profit</th>
                <th scope="col" className="num">Actual yield</th>
                <th scope="col" className="num"><Hint term="Expected yield" /></th>
                <th scope="col" className="num"><Hint term="Expected profit" /></th>
                <th scope="col" className="num"><Hint term="Avg CLV" /></th>
                <th scope="col" className="num"><Hint term="Beat close" /></th>
                <th scope="col" className="num">Open</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.start} className={w.start === thisWeek ? 'today' : ''}>
                  <th scope="row">{weekLabel(w.start)}{tag(w)}</th>
                  <StatCells s={w} currency={currency} />
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={10} className="muted">No bets match these filters.</td></tr>}
            </tbody>
            {list.length > 1 && (
              <tfoot>
                <tr>
                  <th scope="row">All weeks</th>
                  <StatCells s={total} currency={currency} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        )}
      </section>
    </>
  )
}

function StatCells({ s, currency }) {
  return (
    <>
      <td className="num">{s.wagers}</td>
      <td className="num">{money(s.handle, currency)}</td>
      <td className={`num ${tone(s.profit)}`}>{money(s.profit, currency, { sign: true })}</td>
      <td className={`num ${tone(s.yield)}`}>{pct(s.yield)}</td>
      <td className={`num ${tone(s.expYield)}`}>{pct(s.expYield, { digits: 2 })}</td>
      <td className="num">{money(s.expected, currency, { sign: true })}</td>
      <td className={`num ${tone(s.avgClv)}`}>{pct(s.avgClv, { digits: 2 })}</td>
      <td className="num">{pct(s.beatClose, { digits: 1, sign: false })}</td>
      <td className="num">{s.open || '—'}</td>
    </>
  )
}

function WeekTip({ active, payload, currency }) {
  if (!active || !payload?.length) return null
  const w = payload[0].payload
  return (
    <div className="tip">
      <div className="tip-title">{weekLabel(w.start)}</div>
      <div>Profit <strong>{money(w.profit, currency, { sign: true })}</strong></div>
      <div>Handle <strong>{money(w.handle, currency)}</strong></div>
      <div>Wagers <strong>{w.wagers}</strong></div>
    </div>
  )
}
