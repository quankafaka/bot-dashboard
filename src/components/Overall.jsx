import { useMemo, useState } from 'react'
import { PERIODS, currencyGroups, applyPeriod, summarize, cumulative, pooledBalance } from '../lib/metrics'
import { money, pct, tone } from '../lib/format'
import ProfitChart from './ProfitChart'
import { Card } from './Daily'
import Hint from './Hint'
import { SplitBy } from './Performance'
import { useIsMobile } from '../lib/useIsMobile'

// Every book the user can see, added up by currency (currencyGroups): one
// currency at a time, its books pooled into one set of figures, then split
// back out by book. Every bet counts, the bot's and the hand-logged ones
// alike: this page is the money, not the bot.
export default function Overall({ rows, books, accountNames }) {
  const groups = useMemo(() => currencyGroups(books), [books])
  const [picked, setPicked] = useState(groups[0]?.currency)
  const [period, setPeriod] = useState('all')
  const mobile = useIsMobile()
  const group = groups.find((g) => g.currency === picked) ?? groups[0]
  const currency = group?.currency

  const groupRows = useMemo(() => {
    const names = new Set(group?.books.map((b) => b.name))
    return rows.filter((r) => names.has(r.book))
  }, [rows, group])
  const filtered = useMemo(() => applyPeriod(groupRows, period), [groupRows, period])
  const s = useMemo(() => summarize(filtered), [filtered])
  const series = useMemo(() => cumulative(filtered), [filtered])
  const perBook = useMemo(() => (group?.books ?? []).map((b) => (
    { key: b.name, ...summarize(filtered.filter((r) => r.book === b.name)) })), [filtered, group])
  // The whole account, like the header balance: the period does not apply.
  const bal = useMemo(() => (group ? pooledBalance(groupRows, group.books) : null), [groupRows, group])

  if (!group) return <p className="muted pad">No books to add up.</p>
  const luck = s.profit - s.expected
  const bookNames = group.books.map((b) => b.name).join(' + ')

  const bookRow = (g, label, className = '') => (
    <div key={`${className}${g.key}`} className={`day-row ${className}`}>
      <div>
        <div className="day-name">{label}</div>
        <div className="sub">{g.bets} bets, {money(g.turnover, currency)} handle{g.openCount ? `, ${g.openCount} open` : ''}</div>
      </div>
      <div className="day-fig">
        <div className={`bc-money ${tone(g.profit)}`}>{money(g.profit, currency, { sign: true })}</div>
        <div className="sub">{pct(g.roi)} actual, {pct(g.expYield)} exp.</div>
        {g.avgClv != null && <div className="sub">CLV {pct(g.avgClv)}</div>}
      </div>
    </div>
  )
  const tableRow = (g, label) => (
    <>
      <th scope="row">{label}</th>
      <td className="num">{g.bets}</td>
      <td className="num">{money(g.turnover, currency)}</td>
      <td className={`num ${tone(g.profit)}`}>{money(g.profit, currency, { sign: true })}</td>
      <td className={`num ${tone(g.roi)}`}>{pct(g.roi)}</td>
      <td className={`num ${tone(g.expYield)}`}>{pct(g.expYield, { digits: 2 })}</td>
      <td className="num">{money(g.expected, currency, { sign: true })}</td>
      <td className={`num ${tone(g.avgClv)}`}>{pct(g.avgClv, { digits: 2 })}</td>
      <td className="num">{g.openCount || '—'}</td>
    </>
  )

  return (
    <>
      <section className="toolbar" aria-label="Filters">
        <CurrencySwitch groups={groups} value={currency} onChange={setPicked} />
        <div className="seg" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.id} className={period === p.id ? 'on' : ''} aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}>{p.label}</button>
          ))}
        </div>
        <span className="muted">{bookNames}, in {currency}</span>
      </section>

      <div className="cards">
        <Card label="Profit" value={money(s.profit, currency, { sign: true })} valueTone={tone(s.profit)}
          sub={s.bets ? `${money(Math.abs(luck), currency)} ${luck >= 0 ? 'above' : 'below'} expected` : 'No settled bets'} />
        {bal ? (
          <Card label="Balance" value={money(bal.balance, currency)}
            sub={bal.missing.length ? `Leaves out ${bal.missing.join(', ')}: no starting balance`
              : `${money(bal.inPlay, currency)} in play`} />
        ) : (
          <Card label={<Hint term="Expected yield" />} value={pct(s.expYield, { digits: 2 })}
            valueTone={tone(s.expYield)} sub="From the closing line, not the EV at placement" />
        )}
        <Card label="Bets" value={s.bets.toLocaleString('en-CA')}
          sub={`${s.openCount} open, ${money(s.openStake, currency)} at risk`} />
        <Card label="Handle" value={money(s.turnover, currency)} sub="Settled bets only" />
        <Card label="Actual yield" value={pct(s.roi, { digits: 2 })} valueTone={tone(s.roi)}
          sub="Profit over settled handle" />
      </div>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Profit, all {currency} books</h2>
            <p className="muted">Actual against expected profit, one step per settled bet across {bookNames}</p>
          </div>
        </header>
        <ProfitChart data={series} currency={currency} />
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>By book</h2>
        </header>
        {mobile ? (
          <div className="day-list">
            {perBook.map((g) => bookRow(g, g.key))}
            {perBook.length > 1 && bookRow({ key: 'total', ...s }, 'Total', 'total')}
          </div>
        ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Book</th>
                <th scope="col" className="num">Bets</th>
                <th scope="col" className="num">Handle</th>
                <th scope="col" className="num">Profit</th>
                <th scope="col" className="num">Actual yield</th>
                <th scope="col" className="num"><Hint term="Expected yield" /></th>
                <th scope="col" className="num"><Hint term="Expected profit" /></th>
                <th scope="col" className="num"><Hint term="Avg CLV" /></th>
                <th scope="col" className="num">Open</th>
              </tr>
            </thead>
            <tbody>
              {perBook.map((g) => <tr key={g.key}>{tableRow(g, g.key)}</tr>)}
            </tbody>
            {perBook.length > 1 && (
              <tfoot>
                <tr>{tableRow(s, 'Total')}</tr>
              </tfoot>
            )}
          </table>
        </div>
        )}
      </section>

      {/* Sport, league, market... across every book of this currency. */}
      <SplitBy rows={groupRows} filtered={filtered} currency={currency} accountNames={accountNames} />
    </>
  )
}

// The CAD / USD buttons on Overall's tabs. Nothing to switch with one currency.
export function CurrencySwitch({ groups, value, onChange }) {
  if (groups.length < 2) return null
  return (
    <div className="seg" role="group" aria-label="Currency">
      {groups.map((g) => (
        <button key={g.currency} className={g.currency === value ? 'on' : ''}
          aria-pressed={g.currency === value} onClick={() => onChange(g.currency)}>
          {g.currency}
        </button>
      ))}
    </div>
  )
}
