import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { money } from '../lib/format'

const monthFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', month: 'long' })
const monthShort = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', month: 'short' })
// 'YYYY-MM' to "October" / "Oct".
export const monthName = (ym, fmt = monthFmt) => fmt.format(new Date(`${ym}-15T12:00:00Z`))
const short = (v, currency) => money(v, currency).replace(/\.\d\d$/, '')

// The Overall Pending tab's month chart (monthCumulative): handle placed so
// far in the month, day by day, the month before dashed under it, the 1st on
// the 1st.
export default function MonthChart({ data, currency, ym, pm }) {
  const now = monthName(ym, monthShort)
  const before = monthName(pm, monthShort)
  return (
    <div className="chart short">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24}
            tick={{ fill: 'var(--muted-2)', fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} width={72} allowDecimals={false}
            tick={{ fill: 'var(--muted-2)', fontSize: 12 }} tickFormatter={(v) => short(v, currency)} />
          <Tooltip content={<Tip currency={currency} now={now} before={before} />}
            cursor={{ stroke: 'var(--border-strong)' }} />
          <Legend verticalAlign="bottom" height={32} iconType="plainline" iconSize={14}
            formatter={(v) => <span className="legend-text">{v}</span>} />
          <Line type="monotone" dataKey="prevHandle" name={monthName(pm)} stroke="var(--muted-2)"
            strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="handle" name={monthName(ym)} stroke="#3ddc84" strokeWidth={2}
            dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Tip({ active, payload, currency, now, before }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const bets = (n) => `${n} ${n === 1 ? 'bet' : 'bets'}`
  const change = p.handle != null && p.prevHandle ? Math.round((p.handle / p.prevHandle - 1) * 100) : null
  return (
    <div className="tip">
      <div className="tip-title">To the {p.day}{nth(p.day)}</div>
      {p.handle != null && <div>{now} <strong>{money(p.handle, currency)}</strong>, {bets(p.bets)}</div>}
      {p.prevHandle != null && <div>{before} <strong>{money(p.prevHandle, currency)}</strong>, {bets(p.prevBets)}</div>}
      {change != null && <div>{change > 0 ? '+' : ''}{change}% on {before} to the same day</div>}
    </div>
  )
}

const nth = (d) => (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th')
