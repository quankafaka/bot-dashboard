import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { money } from '../lib/format'

export default function ProfitChart({ data, currency }) {
  if (data.length < 2) {
    return <div className="chart empty">The chart appears once two bets have settled.</div>
  }
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f9d3a" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#0b3d17" stopOpacity={0.35} />
            </linearGradient>
            <linearGradient id="gExpected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ddc84" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#0f5a32" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="n" tickLine={false} axisLine={false} minTickGap={36}
            tick={{ fill: 'var(--muted-2)', fontSize: 12 }} tickFormatter={(n) => `Bet ${n}`} />
          <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--muted-2)', fontSize: 12 }}
            tickFormatter={(v) => money(v, currency).replace(/\.00$/, '')} />
          <Tooltip content={<Tip currency={currency} />} cursor={{ stroke: 'var(--border-strong)' }} />
          <Legend verticalAlign="bottom" height={32} iconType="square" iconSize={10}
            formatter={(v) => <span className="legend-text">{v}</span>} />
          <Area type="linear" dataKey="profit" name="Actual profit" stroke="#22c55e" strokeWidth={1.5}
            fill="url(#gActual)" isAnimationActive={false} />
          <Area type="linear" dataKey="expected" name="Expected profit (CLV)" stroke="#3ddc84" strokeWidth={1.5}
            fill="url(#gExpected)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function Tip({ active, payload, currency }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="tip">
      <div className="tip-title">Bet {p.n}, {p.date}</div>
      <div>Actual <strong>{money(p.profit, currency, { sign: true })}</strong></div>
      <div>Expected <strong>{money(p.expected, currency, { sign: true })}</strong></div>
    </div>
  )
}
