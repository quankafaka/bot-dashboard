import { useMemo, useState } from 'react'
import { PERIODS, currencyGroups, applyPeriod, summarize, cumulative, pooledBalance } from '../lib/metrics'
import { money, pct, tone } from '../lib/format'
import ProfitChart from './ProfitChart'
import { Card } from './Daily'
import Hint from './Hint'
import { SplitBy } from './Performance'

// Every book the user can see, added up by currency (currencyGroups): one
// currency at a time, its books pooled into one set of figures, then split
// back out by book. Every bet counts, the bot's and the hand-logged ones
// alike: this page is the money, not the bot.
export default function Overall({ rows, books, accountNames }) {
  const groups = useMemo(() => currencyGroups(books), [books])
  const [picked, setPicked] = useState(groups[0]?.currency)
  const [period, setPeriod] = useState('all')
  const group = groups.find((g) => g.currency === picked) ?? groups[0]
  const currency = group?.currency

  const groupRows = useMemo(() => {
    const names = new Set(group?.books.map((b) => b.name))
    return rows.filter((r) => names.has(r.book))
  }, [rows, group])
  const filtered = useMemo(() => applyPeriod(groupRows, period), [groupRows, period])
  const s = useMemo(() => summarize(filtered), [filtered])
  const series = useMemo(() => cumulative(filtered), [filtered])
  // The whole account, like the header balance: the period does not apply.
  const bal = useMemo(() => (group ? pooledBalance(groupRows, group.books) : null), [groupRows, group])

  if (!group) return <p className="muted pad">No books to add up.</p>
  const luck = s.profit - s.expected
  const bookNames = group.books.map((b) => b.name).join(' + ')

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

      {/* By book, sport, league, market... across every book of this currency. */}
      <SplitBy rows={groupRows} filtered={filtered} currency={currency} accountNames={accountNames} initial="book" />
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
