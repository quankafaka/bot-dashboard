import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts'
import { applyFilters, week, localToday, weekStart, addDays } from '../lib/metrics'
import { money, pct, tone, dayLabel, shortDay, shortDate } from '../lib/format'
import Filters from './Filters'

export default function Daily({ rows, filters, setFilters, currency, accountNames }) {
  const thisWeek = weekStart(localToday())
  const [start, setStart] = useState(thisWeek)
  const today = localToday()

  const filtered = useMemo(() => applyFilters(rows, { ...filters, period: 'all' }), [rows, filters])
  const w = useMemo(() => week(filtered, start), [filtered, start])
  const t = w.total

  return (
    <>
      <Filters rows={rows} filters={filters} setFilters={setFilters} accountNames={accountNames} showPeriod={false}>
        <div className="week-nav" role="group" aria-label="Week">
          <button className="btn icon" aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}>‹</button>
          <span className="week-label">{shortDate(start)} – {shortDate(addDays(start, 6))}</span>
          <button className="btn icon" aria-label="Next week" disabled={start >= thisWeek}
            onClick={() => setStart(addDays(start, 7))}>›</button>
          {start !== thisWeek && <button className="btn" onClick={() => setStart(thisWeek)}>This week</button>}
        </div>
      </Filters>

      <div className="cards">
        <Card label="Profit" value={money(t.profit, currency, { sign: true })} valueTone={tone(t.profit)}
          sub={`Expected ${money(t.expected, currency, { sign: true })}`} />
        <Card label="Wagers" value={t.wagers.toLocaleString('en-CA')}
          sub={t.open ? `${t.settled} settled, ${t.open} open` : 'All settled'} />
        <Card label="Handle" value={money(t.handle, currency)}
          sub={t.wagers ? `${money(t.handle / t.wagers, currency)} average stake` : 'No wagers'} />
        <Card label="Yield" value={pct(t.yield, { digits: 2 })} valueTone={tone(t.yield)}
          sub="Profit over settled handle" />
        <Card label="Average CLV" value={pct(t.avgClv, { digits: 2 })} valueTone={tone(t.avgClv)}
          sub="Against the closing fair price" />
      </div>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Profit by day</h2>
            <p className="muted">Bets are counted on the day they were placed, Montreal time</p>
          </div>
        </header>
        <div className="chart short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={w.days} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDay} tickLine={false} axisLine={false}
                tick={{ fill: 'var(--muted-2)', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--muted-2)', fontSize: 12 }}
                tickFormatter={(v) => money(v, currency).replace(/\.00$/, '')} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<DayTip currency={currency} />} />
              <Bar dataKey="profit" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {w.days.map((d) => <Cell key={d.date} fill={d.profit >= 0 ? 'var(--green)' : 'var(--red)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col" className="num">Wagers</th>
                <th scope="col" className="num">Handle</th>
                <th scope="col" className="num">Profit</th>
                <th scope="col" className="num">Yield</th>
                <th scope="col" className="num">Avg CLV</th>
                <th scope="col" className="num">Expected</th>
                <th scope="col" className="num">Open</th>
              </tr>
            </thead>
            <tbody>
              {w.days.map((d) => (
                <tr key={d.date} className={d.date === today ? 'today' : ''}>
                  <th scope="row">{dayLabel(d.date)}{d.date === today && <span className="tag">Today</span>}</th>
                  {d.date > today ? (
                    <td colSpan={7} className="muted">Not played yet</td>
                  ) : (
                    <>
                      <td className="num">{d.wagers}</td>
                      <td className="num">{money(d.handle, currency)}</td>
                      <td className={`num ${tone(d.profit)}`}>{money(d.profit, currency, { sign: true })}</td>
                      <td className={`num ${tone(d.yield)}`}>{pct(d.yield)}</td>
                      <td className={`num ${tone(d.avgClv)}`}>{pct(d.avgClv, { digits: 2 })}</td>
                      <td className="num">{money(d.expected, currency, { sign: true })}</td>
                      <td className="num">{d.open || '—'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Week</th>
                <td className="num">{t.wagers}</td>
                <td className="num">{money(t.handle, currency)}</td>
                <td className={`num ${tone(t.profit)}`}>{money(t.profit, currency, { sign: true })}</td>
                <td className={`num ${tone(t.yield)}`}>{pct(t.yield)}</td>
                <td className={`num ${tone(t.avgClv)}`}>{pct(t.avgClv, { digits: 2 })}</td>
                <td className="num">{money(t.expected, currency, { sign: true })}</td>
                <td className="num">{t.open || '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  )
}

export function Card({ label, value, sub, valueTone = '' }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className={`card-value ${valueTone}`}>{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  )
}

function DayTip({ active, payload, currency }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="tip">
      <div className="tip-title">{dayLabel(d.date)}</div>
      <div>Profit <strong>{money(d.profit, currency, { sign: true })}</strong></div>
      <div>Handle <strong>{money(d.handle, currency)}</strong></div>
      <div>Wagers <strong>{d.wagers}</strong></div>
    </div>
  )
}
