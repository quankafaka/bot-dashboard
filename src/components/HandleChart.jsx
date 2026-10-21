import { ResponsiveContainer, ComposedChart, Line, Bar, LabelList, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { money } from '../lib/format'
import { HANDLE_RANGES } from '../lib/metrics'

// Hours and days read on Montreal time, like the rest of the site.
const zone = 'America/Toronto'
const hourFmt = new Intl.DateTimeFormat('en-CA', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false })
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric' })
const hour = (ms) => hourFmt.format(new Date(ms))
const day = (ms) => dayFmt.format(new Date(ms))
const PERIOD = { '24h': 'day', '7d': 'week' }
const short = (v, currency) => money(v, currency).replace(/\.\d\d$/, '')

// The Overall Pending tab's handle chart (handleSeries): handle placed over
// the range, every system together, with the range before laid under it,
// point for point. The day is a smooth line (the one before dashed); the
// week is a bar per day, this week's narrow and bright in
// front of last week's wide and faded, each on its own axis so they overlap
// instead of standing side by side.
export default function HandleChart({ data, currency, range }) {
  const r = HANDLE_RANGES.find((x) => x.id === range)
  const week = range === '7d'
  const before = week ? 'Week before' : `${r.label} before`
  // The day's points fall every 10 minutes; ticks only on the hour.
  const ticks = week ? undefined : data.filter((b) => hour(b.ms).endsWith(':00')).map((b) => b.ms)
  const tickLabel = (ms) => (week ? day(ms).replace(/,.*/, '') : hour(ms))
  return (
    <div className="chart short">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="ms" tickLine={false} axisLine={false} minTickGap={week ? 4 : 36}
            ticks={ticks} interval={week ? 0 : 'preserveEnd'}
            tick={{ fill: 'var(--muted-2)', fontSize: 12 }} tickFormatter={tickLabel} />
          {week && <XAxis xAxisId="prev" dataKey="ms" hide />}
          <YAxis tickLine={false} axisLine={false} width={64} allowDecimals={false}
            tick={{ fill: 'var(--muted-2)', fontSize: 12 }} tickFormatter={(v) => short(v, currency)} />
          <Tooltip content={<Tip currency={currency} range={r} before={before} />}
            cursor={week ? { fill: 'var(--grid)' } : { stroke: 'var(--border-strong)' }} />
          <Legend verticalAlign="bottom" height={32} iconType={week ? 'square' : 'plainline'} iconSize={week ? 10 : 14}
            formatter={(v) => <span className="legend-text">{v}</span>} />
          {week ? [
            <Bar key="prev" xAxisId="prev" dataKey="prevHandle" name={before}
              fill="var(--muted-2)" fillOpacity={0.3} stroke="var(--muted-2)" strokeOpacity={0.6}
              radius={[3, 3, 0, 0]} isAnimationActive={false} />,
            <Bar key="now" dataKey="handle" name={`Last ${r.label}`} fill="#3ddc84"
              shape={<Inset />} isAnimationActive={false}>
              <LabelList dataKey="handle" position="top" fill="var(--muted)" fontSize={11}
                formatter={(v) => (v ? short(v, currency) : '')} />
            </Bar>,
          ] : [
            <Line key="prev" type="monotone" dataKey="prevHandle" name={before} stroke="var(--muted-2)"
              strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />,
            <Line key="now" type="monotone" dataKey="handle" name={`Last ${r.label}`} stroke="#3ddc84" strokeWidth={2}
              dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />,
          ]}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// This week's bar, drawn at half the width of its slot so last week's shows
// on either side of it, even where this week is the taller.
function Inset({ x, y, width, height, fill }) {
  if (!height) return null
  const w = width * 0.5
  const r = Math.min(3, w / 2, height)
  const left = x + (width - w) / 2
  return (
    <path fill={fill} d={`M${left},${y + height}V${y + r}Q${left},${y} ${left + r},${y}H${left + w - r}`
      + `Q${left + w},${y} ${left + w},${y + r}V${y + height}Z`} />
  )
}

function Tip({ active, payload, currency, range, before }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const { step, buckets, window } = range
  const span = step * buckets
  const week = range.id === '7d'
  // A day point is its own day; a 24-hour point is the hour up to the end of its step.
  const when = (ms) => (week ? day(ms) : `${hour(ms + step - window * step)} to ${hour(ms + step)}`)
  const bets = (n) => `${n} ${n === 1 ? 'bet' : 'bets'}`
  const change = p.prevHandle ? Math.round((p.handle / p.prevHandle - 1) * 100) : null
  return (
    <div className="tip">
      <div className="tip-title">{when(p.ms)}</div>
      <div>Handle <strong>{money(p.handle, currency)}</strong>, {bets(p.bets)}</div>
      <div>
        {before} ({when(p.ms - span)}) <strong>{money(p.prevHandle, currency)}</strong>, {bets(p.prevBets)}
      </div>
      {change != null && <div>{change > 0 ? '+' : ''}{change}% on the {PERIOD[range.id]} before</div>}
    </div>
  )
}
