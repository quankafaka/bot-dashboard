import { useMemo, useState } from 'react'
import { money, pct, tone, betTime, multiAccount, when, bookZone, zoneOffsetMs } from '../lib/format'
import { useOdds } from '../lib/odds'
import AlertCell, { MoveCell, LimitCell, hasLimits } from './AlertCell'
import BetCard from './BetCard'
import HandleChart from './HandleChart'
import MonthChart, { monthName } from './MonthChart'
import Hint from './Hint'
import { Card } from './Daily'
import { useIsMobile, BET_TABLE_QUERY } from '../lib/useIsMobile'
import { betLabel, SOURCE_LABEL, EXPOSURE_DIMENSIONS, exposure, exposureKey, toWin, currencyGroups, stakeWeighted, handleSeries, HANDLE_RANGES, monthCumulative, prevMonth, placedMonths, localToday } from '../lib/metrics'

const PAGE = 100

// The Overall page's Pending tab: every website's open bets. On top, what is
// riding where: handle and to win split by sport, market, game or website,
// for one website or several of the same currency (every website of the
// first currency to start with). Clicking a group narrows the bet list under
// it to that group. The list is the book Pending tab's, newest placed first,
// with a Website column when more than one website is shown.
export default function OverallPending({ rows, books, accountNames }) {
  const [q, setQ] = useState('')
  const fmt = useOdds()
  const [shown, setShown] = useState(PAGE)
  const [sites, setSites] = useState(() => currencyGroups(books)[0]?.books.map((b) => b.name) ?? [])
  const [dim, setDim] = useState('sport')
  const [focus, setFocus] = useState(null) // { dim, key, label } of the clicked group
  const mobile = useIsMobile(BET_TABLE_QUERY)
  const narrow = useIsMobile()

  const currency = books.find((b) => b.name === sites[0])?.currency
  const groups = useMemo(() => currencyGroups(books), [books])
  const multiSite = sites.length > 1
  const open = useMemo(() => {
    const on = new Set(sites)
    return rows.filter((r) => r.status === 'pending' && on.has(r.book))
  }, [rows, sites])
  const split = useMemo(() => exposure(open, dim), [open, dim])
  const handle = open.reduce((t, r) => t + (r.stake ?? 0), 0)
  const win = open.reduce((t, r) => t + toWin(r), 0)
  const games = useMemo(() => exposure(open, 'game').length, [open])
  const evLog = stakeWeighted(open, 'ev_pct_log')
  const evNow = stakeWeighted(open, 'current_ev_pct')
  // Every bet these websites placed in the range and the one before, settled or not.
  const [range, setRange] = useState('24h')
  const series = useMemo(() => {
    const on = new Set(sites)
    const now = Date.now()
    return handleSeries(rows.filter((r) => on.has(r.book)), range, now, zoneOffsetMs(now))
  }, [rows, sites, range])
  const rangeLabel = HANDLE_RANGES.find((r) => r.id === range).label
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

  const showLimit = hasLimits(open)
  const showAccount = multiAccount(open)
  const pending = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return open
      .filter((r) => !focus || exposureKey(focus.dim, r) === focus.key)
      .filter((r) => !needle || `${r.home_team} ${r.away_team} ${r.league} ${r.selection}`.toLowerCase().includes(needle))
      .sort((a, b) => b.placedMs - a.placedMs)
  }, [open, q, focus])
  const atRisk = pending.reduce((t, r) => t + (r.stake ?? 0), 0)
  const empty = open.length === 0 ? 'No open bets right now.'
    : q ? `No open bets match “${q}”.` : 'No open bets in this group.'

  // A website of another currency starts a new selection: CAD and USD never
  // add up. Within a currency, websites toggle, never down to none.
  const pickSite = (name) => {
    setFocus(null)
    setShown(PAGE)
    const ccy = books.find((b) => b.name === name)?.currency
    setSites((s) => {
      if (ccy !== currency) return [name]
      if (!s.includes(name)) return [...s, name]
      return s.length > 1 ? s.filter((x) => x !== name) : s
    })
  }
  const pickAll = (g) => { setFocus(null); setShown(PAGE); setSites(g.books.map((b) => b.name)) }
  const pickDim = (id) => { setDim(id); setFocus(null) }
  const pickGroup = (g, label) => {
    setShown(PAGE)
    setFocus((f) => (f?.dim === dim && f.key === g.key ? null : { dim, key: g.key, label }))
  }
  const dims = EXPOSURE_DIMENSIONS.filter((d) => d.id !== 'book' || multiSite)
  const shownDim = dims.some((d) => d.id === dim) ? dim : 'sport'

  const groupLabel = (g) => (g.game ? `${g.game.home_team} v ${g.game.away_team}` : g.key)
  const groupSub = (g) => (g.game
    ? `${g.game.league}${g.game.start_time ? `, starts ${when(g.game.start_time, bookZone(g.game.book))}` : ''}`
    : null)
  const isFocus = (g) => focus?.dim === shownDim && focus.key === g.key

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

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>What is riding where</h2>
            <p className="muted">Click a row to list only its bets below</p>
          </div>
          <div className="seg" role="group" aria-label="Split by">
            {dims.map((d) => (
              <button key={d.id} className={shownDim === d.id ? 'on' : ''} aria-pressed={shownDim === d.id}
                onClick={() => pickDim(d.id)}>{d.label}</button>
            ))}
          </div>
        </header>
        {narrow ? (
          <div className="day-list">
            {split.map((g) => (
              <button key={g.key} className={`day-row pick ${isFocus(g) ? 'today' : ''}`}
                aria-pressed={isFocus(g)} onClick={() => pickGroup(g, groupLabel(g))}>
                <div>
                  <div className="day-name">{groupLabel(g)}</div>
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
                <th scope="col">{dims.find((d) => d.id === shownDim)?.label}</th>
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
              {split.map((g) => (
                <tr key={g.key} className={`pick ${isFocus(g) ? 'today' : ''}`}
                  onClick={() => pickGroup(g, groupLabel(g))}>
                  <th scope="row">
                    <button className="link" aria-pressed={isFocus(g)}
                      onClick={(e) => { e.stopPropagation(); pickGroup(g, groupLabel(g)) }}>
                      {groupLabel(g)}
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
          <div>
            <h2>Handle, last {rangeLabel}</h2>
            <p className="muted">
              Placed {range === '24h' ? 'per hour, every 10 minutes' : 'per day'}, every system together: {money(placed, currency)} on {placedBets.toLocaleString('en-CA')} {placedBets === 1 ? 'bet' : 'bets'},
              against {money(prevPlaced, currency)} the {rangeLabel} before
              {prevPlaced > 0 && ` (${pct((placed / prevPlaced - 1) * 100, { digits: 0 })})`}
            </p>
          </div>
          <div className="seg" role="group" aria-label="Chart range">
            {HANDLE_RANGES.map((r) => (
              <button key={r.id} className={range === r.id ? 'on' : ''} aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}>{r.label}</button>
            ))}
          </div>
        </header>
        <HandleChart data={series.points} currency={currency} range={range} />
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Handle, {monthName(ym)} {ym.slice(0, 4)}</h2>
            <p className="muted">
              Running total, every system together: {money(month.handle, currency)} on {month.bets.toLocaleString('en-CA')} {month.bets === 1 ? 'bet' : 'bets'},
              against {money(month.prevHandle, currency)} in {monthName(prevMonth(ym))}
            </p>
          </div>
          <div className="pickers">
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
          </div>
        </header>
        <MonthChart data={month.points} currency={currency} ym={ym} pm={prevMonth(ym)} />
      </section>

      <div className="search">
        <label htmlFor="q-pending">Find a bet</label>
        <input id="q-pending" type="search" placeholder="Team, league or selection" value={q}
          onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} />
        {focus && (
          <button className="btn chip" onClick={() => setFocus(null)} aria-label={`Show all, not only ${focus.label}`}>
            {focus.label} <span aria-hidden="true">×</span>
          </button>
        )}
        <span className="muted">
          {pending.length.toLocaleString('en-CA')} open, {money(atRisk, currency)} at risk
        </span>
      </div>
      {mobile ? (
        <div className="cards-list">
          {pending.slice(0, shown).map((r) => (
            <BetCard key={r.wager_id} r={r} currency={currency} accountNames={accountNames}
              showAccount={showAccount} showBook={multiSite} mode="pending" />
          ))}
          {pending.length === 0 && <p className="muted">{empty}</p>}
        </div>
      ) : (
      <div className="scroll fit">
        <table className="fit">
          <thead>
            <tr>
              <th scope="col">Placed</th>
              {multiSite && <th scope="col">Website</th>}
              <th scope="col">Game</th>
              <th scope="col">Bet</th>
              <th scope="col">Move</th>
              <th scope="col">Alert</th>
              {showLimit && <th scope="col" className="num">Pinnacle limit</th>}
              <th scope="col" className="num">Odds</th>
              <th scope="col" className="num">At risk</th>
              <th scope="col" className="num">To win</th>
              <th scope="col" className="num"><Hint term="EV at log, per bet">EV at log</Hint></th>
              <th scope="col" className="num"><Hint term="EV now">EV now</Hint></th>
              {showAccount && <th scope="col">Account</th>}
            </tr>
          </thead>
          <tbody>
            {pending.slice(0, shown).map((r) => (
              <tr key={r.wager_id}>
                <td className="keep">{betTime(r)}</td>
                {multiSite && <td>{r.book}</td>}
                <td className="long">
                  <div>{r.home_team} v {r.away_team}</div>
                  <div className="sub">
                    {r.league}{r.start_time && `, starts ${when(r.start_time, bookZone(r.book))}`}
                  </div>
                </td>
                <td className="long">
                  <div>{r.selection}</div>
                  <div className="sub">
                    {betLabel(r)}
                    {r.source !== 'bot' && <span className="tag">{SOURCE_LABEL[r.source] ?? r.source}</span>}
                    {r.is_freebet && <span className="tag">Free bet</span>}
                  </div>
                </td>
                <MoveCell r={r} />
                <AlertCell r={r} />
                {showLimit && <LimitCell r={r} />}
                <td className="num">{fmt(r.price_filled)}</td>
                <td className="num">{money(r.stake, currency)}</td>
                <td className="num">{money(toWin(r), currency)}</td>
                <td className={`num ${tone(r.ev_pct_log)}`}>{pct(r.ev_pct_log)}</td>
                <td className={`num ${tone(r.current_ev_pct)}`}>{pct(r.current_ev_pct)}</td>
                {showAccount && <td>{accountNames[r.account] ?? r.account}</td>}
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={10 + (multiSite ? 1 : 0) + (showLimit ? 1 : 0) + (showAccount ? 1 : 0)} className="muted">{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      {pending.length > shown && (
        <button className="more" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, pending.length - shown)} more
        </button>
      )}
    </section>
  )
}
