import { Fragment, useMemo, useState } from 'react'
import { money, pct, tone, when, bookZone } from '../lib/format'
import { useOdds } from '../lib/odds'
import { riskByGame, RISK_COLUMNS } from '../lib/metrics'
import { useIsMobile } from '../lib/useIsMobile'
import Hint from './Hint'

// When a game starts, from now: "in 2h 10m", or Live once it has.
function startsIn(ms, now) {
  if (ms == null) return null
  const min = Math.round((ms - now) / 60_000)
  if (min <= 0) return 'Live'
  if (min < 60) return `in ${min}m`
  if (min < 24 * 60) return `in ${Math.floor(min / 60)}h ${min % 60}m`
  return `in ${Math.round(min / (24 * 60))}d`
}

// The Risk by game tab: the open bets one game at a time, soonest first, with
// the handle on each market and, clicked, the positions on it by side and
// line (same side and line added up). toolbar() draws the row above:
// Overall's currency switch; nothing on a book's page.
export default function RiskByGame({ rows, currency, toolbar = () => null }) {
  const fmt = useOdds()
  const mobile = useIsMobile()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const now = Date.now()

  const all = useMemo(() => riskByGame(rows.filter((r) => r.status === 'pending')), [rows])
  const games = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle
      ? all.filter((g) => `${g.game.home_team} ${g.game.away_team} ${g.game.league} ${g.game.sport}`.toLowerCase().includes(needle))
      : all
  }, [all, q])
  // A market column only when some game has money on it.
  const cols = RISK_COLUMNS.filter((c) => all.some((g) => g.byMarket[c] > 0))
  const multiBook = new Set(all.flatMap((g) => g.books)).size > 1
  const handle = games.reduce((t, g) => t + g.handle, 0)
  const live = games.filter((g) => g.game.startMs != null && g.game.startMs <= now)
  const next = games.find((g) => g.game.startMs > now)
  const biggest = games.reduce((m, g) => (!m || g.handle > m.handle ? g : m), null)

  const toggle = (k) => setOpen((o) => {
    const n = new Set(o)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    return n
  })
  const name = (g) => `${g.game.home_team} v ${g.game.away_team}`
  const start = (g) => {
    const s = startsIn(g.game.startMs, now)
    return s === 'Live' ? <span className="tag live">Live</span> : s && <span className="muted">{s}</span>
  }
  // The line after the side, unless the selection names it already ("Over 164.5").
  const lineText = (p) => (p.line == null || String(p.selection).includes(String(Math.abs(p.line))) ? ''
    : p.line > 0 && p.market.startsWith('Handicap') ? `+${p.line}` : String(p.line))

  const positions = (g) => (
    <table className="positions">
      <thead>
        <tr>
          <th scope="col">Market</th>
          <th scope="col">Side</th>
          <th scope="col" className="num">Bets</th>
          <th scope="col" className="num">Odds</th>
          <th scope="col" className="num">At risk</th>
          <th scope="col" className="num">To win</th>
          <th scope="col" className="num"><Hint term="EV now, weighted">EV now</Hint></th>
          {multiBook && <th scope="col">Website</th>}
        </tr>
      </thead>
      <tbody>
        {g.positions.map((p) => (
          <tr key={p.key}>
            <td>{p.market}</td>
            <td>{p.selection} {lineText(p)}</td>
            <td className="num">{p.bets}</td>
            <td className="num">{p.odds ? fmt(p.odds) : '—'}</td>
            <td className="num">{money(p.handle, currency)}</td>
            <td className="num">{money(p.toWin, currency)}</td>
            <td className={`num ${tone(p.evNow)}`}>{pct(p.evNow, { digits: 2 })}</td>
            {multiBook && <td>{p.books.join(', ')}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <>
      {toolbar(null)}

      <div className="cards wide">
        <div className="card">
          <div className="card-label">Games</div>
          <div className="card-value">{games.length.toLocaleString('en-CA')}</div>
          <div className="card-sub">{live.length ? `${live.length} live now` : 'None live now'}</div>
        </div>
        <div className="card">
          <div className="card-label">At risk</div>
          <div className="card-value">{money(handle, currency)}</div>
          <div className="card-sub">{games.length ? `${money(handle / games.length, currency)} a game on average` : 'No open bets'}</div>
        </div>
        <div className="card">
          <div className="card-label">Biggest game</div>
          <div className="card-value">{biggest ? money(biggest.handle, currency) : '—'}</div>
          <div className="card-sub">{biggest ? name(biggest) : 'No open bets'}</div>
        </div>
        <div className="card">
          <div className="card-label">Next to start</div>
          <div className="card-value">{next ? startsIn(next.game.startMs, now) : '—'}</div>
          <div className="card-sub">{next ? `${name(next)}, ${money(next.handle, currency)}` : 'Nothing scheduled'}</div>
        </div>
      </div>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Risk by game</h2>
            <p className="muted">Soonest first. Click a game for its positions by side and line.</p>
          </div>
          <div className="search">
            <input type="search" aria-label="Find a game" placeholder="Team, league or sport" value={q}
              onChange={(e) => setQ(e.target.value)} />
          </div>
        </header>
        {mobile ? (
          <div className="day-list">
            {games.map((g) => (
              <Fragment key={g.key}>
                <button className="day-row pick group" aria-expanded={open.has(g.key)} onClick={() => toggle(g.key)}>
                  <div>
                    <div className="day-name">
                      <span className="fold" aria-hidden="true">{open.has(g.key) ? '▾' : '▸'}</span>{name(g)}
                    </div>
                    <div className="sub">{g.game.league}, {when(g.game.start_time, bookZone(g.game.book))} {start(g)}</div>
                  </div>
                  <div className="day-fig">
                    <div className="bc-money">{money(g.handle, currency)}</div>
                    <div className="sub">{g.bets} bets, to win {money(g.toWin, currency)}</div>
                  </div>
                </button>
                {open.has(g.key) && g.positions.map((p) => (
                  <div key={p.key} className="day-row child">
                    <div>
                      <div className="day-name">{p.selection} {lineText(p)}</div>
                      <div className="sub">{p.market}, {p.bets} {p.bets === 1 ? 'bet' : 'bets'} at {p.odds ? fmt(p.odds) : '—'}</div>
                    </div>
                    <div className="day-fig">
                      <div className="bc-money">{money(p.handle, currency)}</div>
                      <div className="sub">to win {money(p.toWin, currency)}</div>
                    </div>
                  </div>
                ))}
              </Fragment>
            ))}
            {games.length === 0 && <p className="muted pad-s">{q ? `No game matches “${q}”.` : 'No open bets right now.'}</p>}
          </div>
        ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">Starts</th>
                <th scope="col" className="num">Bets</th>
                {cols.map((c) => <th key={c} scope="col" className="num">{c}</th>)}
                <th scope="col" className="num">At risk</th>
                <th scope="col" className="num">To win</th>
                <th scope="col" className="num"><Hint term="EV now, weighted">EV now</Hint></th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <Fragment key={g.key}>
                  <tr className={`pick group ${open.has(g.key) ? 'today' : ''}`} onClick={() => toggle(g.key)}>
                    <th scope="row">
                      <button className="link" aria-expanded={open.has(g.key)}
                        onClick={(e) => { e.stopPropagation(); toggle(g.key) }}>
                        <span className="fold" aria-hidden="true">{open.has(g.key) ? '▾' : '▸'}</span>{name(g)}
                      </button>
                      <span className="sub">{g.game.league}{multiBook ? `, ${g.books.join(', ')}` : ''}</span>
                    </th>
                    <td className="keep">
                      <div>{when(g.game.start_time, bookZone(g.game.book))}</div>
                      <div className="sub">{start(g)}</div>
                    </td>
                    <td className="num">{g.bets}</td>
                    {cols.map((c) => <td key={c} className="num">{g.byMarket[c] ? money(g.byMarket[c], currency) : ''}</td>)}
                    <td className="num strong">{money(g.handle, currency)}</td>
                    <td className="num">{money(g.toWin, currency)}</td>
                    <td className={`num ${tone(g.evNow)}`}>{pct(g.evNow, { digits: 2 })}</td>
                  </tr>
                  {open.has(g.key) && (
                    <tr className="detail"><td colSpan={cols.length + 6}>{positions(g)}</td></tr>
                  )}
                </Fragment>
              ))}
              {games.length === 0 && (
                <tr><td colSpan={cols.length + 6} className="muted">{q ? `No game matches “${q}”.` : 'No open bets right now.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </>
  )
}
