import { useMemo, useState } from 'react'
import { money, pct, tone, when, bookZone, zoneOffsetMs } from '../lib/format'
import { useOdds } from '../lib/odds'
import HandleChart from './HandleChart'
import MonthChart, { monthName } from './MonthChart'
import Hint from './Hint'
import { Card } from './Daily'
import { SplitMenu } from './Performance'
import { useIsMobile } from '../lib/useIsMobile'
import { EXPOSURE_DIMENSIONS, exposure, toWin, currencyGroups, stakeWeighted, handleSeries, HANDLE_RANGES, monthCumulative, prevMonth, placedMonths, localToday } from '../lib/metrics'

// The Overall page's Pending tab: every website's open bets. On top, what is
// riding where: handle and to win split by sport, market or website, for one
// website or several of the same currency (every website of the first
// currency to start with), then the handle placed over time. No bet list:
// Risk by game has the positions.
export default function OverallPending({ rows, books, accountNames }) {
  const [sites, setSites] = useState(() => currencyGroups(books)[0]?.books.map((b) => b.name) ?? [])
  const [dim, setDim] = useState('sport')
  const [inner, setInner] = useState(null) // Split by: a second level, folded until its group is clicked
  const [unfolded, setUnfolded] = useState(() => new Set())
  const narrow = useIsMobile()

  const currency = books.find((b) => b.name === sites[0])?.currency
  const groups = useMemo(() => currencyGroups(books), [books])
  const multiSite = sites.length > 1
  const open = useMemo(() => {
    const on = new Set(sites)
    return rows.filter((r) => r.status === 'pending' && on.has(r.book))
  }, [rows, sites])
  const dims = EXPOSURE_DIMENSIONS.filter((d) => d.id !== 'game' && (d.id !== 'book' || sites.length > 1))
  const shownDim = dims.some((d) => d.id === dim) ? dim : 'sport'
  const shownInner = inner !== shownDim && dims.some((d) => d.id === inner) ? inner : null
  const split = useMemo(() => exposure(open, shownDim, shownInner), [open, shownDim, shownInner])
  const handle = open.reduce((t, r) => t + (r.stake ?? 0), 0)
  const win = open.reduce((t, r) => t + toWin(r), 0)
  const evLog = stakeWeighted(open, 'ev_pct_log')
  const evNow = stakeWeighted(open, 'current_ev_pct')
  // Every bet these websites placed in the range and the one before, settled or not.
  // 'month' shows the calendar month chart below in the same panel instead.
  const [range, setRange] = useState('24h')
  const isMonth = range === 'month'
  const series = useMemo(() => {
    if (isMonth) return { points: [], handle: 0, bets: 0, prevHandle: 0 }
    const on = new Set(sites)
    const now = Date.now()
    return handleSeries(rows.filter((r) => on.has(r.book)), range, now, zoneOffsetMs(now))
  }, [rows, sites, range, isMonth])
  const rangeLabel = HANDLE_RANGES.find((r) => r.id === range)?.label
  const { handle: placed, bets: placedBets, prevHandle: prevPlaced } = series
  // A calendar month's running total, against the month before.
  const thisMonth = localToday().slice(0, 7)
  const [ym, setYm] = useState(thisMonth)
  const month = useMemo(() => {
    const on = new Set(sites)
    return monthCumulative(rows.filter((r) => on.has(r.book)), ym)
  }, [rows, sites, ym])
  const years = useMemo(() => {
    const ys = new Set([thisMonth.slice(0, 4), ...placedMonths(rows).map((m) => m.slice(0, 4))])
    return [...ys].sort().reverse()
  }, [rows, thisMonth])
  // Picking a year keeps the month, unless that month has not come yet.
  const pickYm = (y, m) => setYm(`${y}-${m}` > thisMonth ? thisMonth : `${y}-${m}`)

  // A website of another currency starts a new selection: CAD and USD never
  // add up. Within a currency, websites toggle, never down to none.
  const pickSite = (name) => {
    const ccy = books.find((b) => b.name === name)?.currency
    setSites((s) => {
      if (ccy !== currency) return [name]
      if (!s.includes(name)) return [...s, name]
      return s.length > 1 ? s.filter((x) => x !== name) : s
    })
  }
  const pickAll = (g) => { setSites(g.books.map((b) => b.name)) }
  const pickDim = (id) => { setDim(id); setUnfolded(new Set()) }
  const pickInner = (id) => { setInner(id); setUnfolded(new Set()) }
  // A group with children opens or folds them.
  const pickGroup = (g, parent) => {
    if (parent || !g.children) return
    setUnfolded((o) => {
      const n = new Set(o)
      if (n.has(g.key)) n.delete(g.key)
      else n.add(g.key)
      return n
    })
  }

  const groupLabel = (g) => (g.game ? `${g.game.home_team} v ${g.game.away_team}` : g.key)
  const groupSub = (g) => (g.game
    ? `${g.game.league}${g.game.start_time ? `, starts ${when(g.game.start_time, bookZone(g.game.book))}` : ''}`
    : null)
  // Group rows, each followed by its children when the split nests.
  const lines = split.flatMap((g) => [{ g },
    ...(unfolded.has(g.key) ? g.children ?? [] : []).map((c) => ({ g: c, parent: g }))])
  const fold = (g) => g.children && <span className="fold" aria-hidden="true">{unfolded.has(g.key) ? '▾' : '▸'}</span>
  const lineClass = ({ g, parent }) => (parent ? 'child' : g.children ? 'group' : '')

  return (
    <section>
      {books.length > 1 && (
        <section className="toolbar" aria-label="Websites">
          {groups.map((g) => (
            <div key={g.currency} className="seg" role="group" aria-label={`${g.currency} websites`}>
              {g.books.length > 1 && (
                <button className={g.books.every((b) => sites.includes(b.name)) ? 'on' : ''}
                  aria-pressed={g.books.every((b) => sites.includes(b.name))} onClick={() => pickAll(g)}>
                  All {g.currency}
                </button>
              )}
              {g.books.map((b) => (
                <button key={b.name} className={sites.includes(b.name) ? 'on' : ''}
                  aria-pressed={sites.includes(b.name)} onClick={() => pickSite(b.name)}>
                  {b.name} <span className="ccy">{b.currency}</span>
                </button>
              ))}
            </div>
          ))}
        </section>
      )}

      <OpenCards open={open} currency={currency} />

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>What is riding where</h2>
            <p className="muted">Click a group to open what is under it</p>
          </div>
          <div className="pickers">
            <div className="seg" role="group" aria-label="Group by">
              {dims.map((d) => (
                <button key={d.id} className={shownDim === d.id ? 'on' : ''} aria-pressed={shownDim === d.id}
                  onClick={() => pickDim(d.id)}>{d.label}</button>
              ))}
            </div>
            <SplitMenu value={shownInner} onChange={pickInner}
              options={[{ id: null, label: 'Nothing' }, ...dims.filter((d) => d.id !== shownDim)]} />
          </div>
        </header>
        {narrow ? (
          <div className="day-list">
            {lines.map(({ g, parent }) => (
              <button key={`${parent?.key ?? ''}|${g.key}`} className={`day-row pick ${lineClass({ g, parent })}`}
                aria-expanded={g.children ? unfolded.has(g.key) : undefined} onClick={() => pickGroup(g, parent)}>
                <div>
                  <div className="day-name">{fold(g)}{groupLabel(g)}</div>
                  <div className="sub">{groupSub(g) ?? `${g.bets} bets`}</div>
                </div>
                <div className="day-fig">
                  <div className="bc-money">{money(g.handle, currency)}</div>
                  <div className="sub">to win {money(g.toWin, currency)}</div>
                  <div className="sub">EV {pct(g.evLog)} at log, {pct(g.evNow)} now</div>
                </div>
              </button>
            ))}
            {split.length === 0 && <p className="muted pad-s">No open bets right now.</p>}
          </div>
        ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{[shownDim, shownInner].filter(Boolean).map((id) => dims.find((d) => d.id === id)?.label).join(' › ')}</th>
                <th scope="col" className="num">Bets</th>
                <th scope="col" className="num">Handle</th>
                <th scope="col" className="num">Share</th>
                <th scope="col" className="num">To win</th>
                <th scope="col" className="num">Payout</th>
                <th scope="col" className="num"><Hint term="EV at log, weighted">EV at log</Hint></th>
                <th scope="col" className="num"><Hint term="EV now, weighted">EV now</Hint></th>
              </tr>
            </thead>
            <tbody>
              {lines.map(({ g, parent }) => (
                <tr key={`${parent?.key ?? ''}|${g.key}`} className={`pick ${lineClass({ g, parent })}`}
                  onClick={() => pickGroup(g, parent)}>
                  <th scope="row">
                    <button className="link" aria-expanded={g.children ? unfolded.has(g.key) : undefined}
                      onClick={(e) => { e.stopPropagation(); pickGroup(g, parent) }}>
                      {fold(g)}{groupLabel(g)}
                    </button>
                    {groupSub(g) && <span className="sub">{groupSub(g)}</span>}
                  </th>
                  <td className="num">{g.bets}</td>
                  <td className="num">{money(g.handle, currency)}</td>
                  <td className="num">{handle ? pct(g.handle / handle * 100, { sign: false, digits: 0 }) : '—'}</td>
                  <td className="num">{money(g.toWin, currency)}</td>
                  <td className="num">{money(g.handle + g.toWin, currency)}</td>
                  <td className={`num ${tone(g.evLog)}`}>{pct(g.evLog, { digits: 2 })}</td>
                  <td className={`num ${tone(g.evNow)}`}>{pct(g.evNow, { digits: 2 })}</td>
                </tr>
              ))}
              {split.length === 0 && (
                <tr><td colSpan={8} className="muted">No open bets right now.</td></tr>
              )}
            </tbody>
            {split.length > 1 && (
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="num">{open.length}</td>
                  <td className="num">{money(handle, currency)}</td>
                  <td className="num">100%</td>
                  <td className="num">{money(win, currency)}</td>
                  <td className="num">{money(handle + win, currency)}</td>
                  <td className={`num ${tone(evLog)}`}>{pct(evLog, { digits: 2 })}</td>
                  <td className={`num ${tone(evNow)}`}>{pct(evNow, { digits: 2 })}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          {isMonth ? (
            <div>
              <h2>Handle, {monthName(ym)} {ym.slice(0, 4)}</h2>
              <p className="muted">
                Running total, every system together: {money(month.handle, currency)} on {month.bets.toLocaleString('en-CA')} {month.bets === 1 ? 'bet' : 'bets'},
                against {money(month.prevHandle, currency)} in {monthName(prevMonth(ym))}
              </p>
            </div>
          ) : (
            <div>
              <h2>Handle, last {rangeLabel}</h2>
              <p className="muted">
                Placed {range === '24h' ? 'so far, running total' : 'per day'}, every system together: {money(placed, currency)} on {placedBets.toLocaleString('en-CA')} {placedBets === 1 ? 'bet' : 'bets'},
                against {money(prevPlaced, currency)} the {rangeLabel} before
                {prevPlaced > 0 && ` (${pct((placed / prevPlaced - 1) * 100, { digits: 0 })})`}
              </p>
            </div>
          )}
          <div className="pickers">
            <div className="seg" role="group" aria-label="Chart range">
              {[...HANDLE_RANGES, { id: 'month', label: 'Month' }].map((r) => (
                <button key={r.id} className={range === r.id ? 'on' : ''} aria-pressed={range === r.id}
                  onClick={() => setRange(r.id)}>{r.label}</button>
              ))}
            </div>
            {isMonth && (
              <>
                <select aria-label="Month" value={ym.slice(5)} onChange={(e) => pickYm(ym.slice(0, 4), e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                    <option key={m} value={m} disabled={`${ym.slice(0, 4)}-${m}` > thisMonth}>
                      {monthName(`2000-${m}`)}
                    </option>
                  ))}
                </select>
                <select aria-label="Year" value={ym.slice(0, 4)} onChange={(e) => pickYm(e.target.value, ym.slice(5))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
          </div>
        </header>
        {isMonth
          ? <MonthChart data={month.points} currency={currency} ym={ym} pm={prevMonth(ym)} />
          : <HandleChart data={series.points} currency={currency} range={range} />}
      </section>

    </section>
  )
}

// The key numbers on the open bets: count, handle, to win, payout, odds and
// EV. On Overall's Pending tab and on each book's.
export function OpenCards({ open, currency }) {
  const fmt = useOdds()
  const handle = open.reduce((t, r) => t + (r.stake ?? 0), 0)
  const win = open.reduce((t, r) => t + toWin(r), 0)
  const games = useMemo(() => exposure(open, 'game').length, [open])
  const evLog = stakeWeighted(open, 'ev_pct_log')
  const evNow = stakeWeighted(open, 'current_ev_pct')
  return (
    <div className="cards wide">
      <Card label="Open bets" value={open.length.toLocaleString('en-CA')}
        sub={`On ${games} ${games === 1 ? 'game' : 'games'}`} />
      <Card label="Handle" value={money(handle, currency)} sub="Staked on open bets" />
      <Card label="To win" value={money(win, currency)} valueTone={win ? 'pos' : ''}
        sub="Profit if every open bet wins" />
      <Card label="Payout" value={money(handle + win, currency)} sub="Handle plus to win" />
      <Card label="Avg odds" value={handle ? fmt(1 + win / handle) : '—'} sub="Stake-weighted" />
      <Card label={<Hint term="EV at log, weighted">EV at log</Hint>} value={pct(evLog, { digits: 2 })}
        valueTone={tone(evLog)} sub="Stake-weighted, when each bet went in" />
      <Card label={<Hint term="EV now, weighted">EV now</Hint>} value={pct(evNow, { digits: 2 })}
        valueTone={tone(evNow)} sub="Stake-weighted, at today's Pinnacle line" />
    </div>
  )
}
