import { useMemo, useState } from 'react'
import { MODEL_STRATEGIES, STRATEGY_LABEL, applyFilters, summarize } from '../lib/metrics'
import { pct, tone } from '../lib/format'
import Performance from './Performance'
import Pending from './Pending'
import Graded from './Graded'
import { Card } from './Daily'

// The BetInAsian bets placed by the NFL / CFB derivative models, on their own.
// The same numbers as the Overview tab (profit, yield, expected yield, the
// chart, the split-by table), over model bets only -- plus closing-line value,
// which both model repos say is what the first season should be judged on.
// The Overview tab still shows everything: it is one account.
const LEAGUES = [
  ['all', 'NFL + CFB'],
  ['nfl_model', 'NFL'],
  ['cfb_model', 'CFB'],
]

export default function Models({ rows, filters, setFilters, currency, accountNames, labelsReady }) {
  const [league, setLeague] = useState('all')
  const [list, setList] = useState('graded')

  const modelRows = useMemo(() => rows.filter((r) => MODEL_STRATEGIES.includes(r.strategy)
    && (league === 'all' || r.strategy === league)), [rows, league])
  const s = useMemo(() => summarize(applyFilters(modelRows, filters)), [modelRows, filters])

  if (!labelsReady) {
    return (
      <p className="empty-state">
        This page needs migration 008 (<code>migrations/008_strategy.sql</code>), which records
        which system took each bet. Run it in Supabase, let the bot sync once, then press Refresh.
      </p>
    )
  }

  const leagueSeg = (
    <div className="seg" role="group" aria-label="Model">
      {LEAGUES.map(([id, label]) => (
        <button key={id} className={league === id ? 'on' : ''} aria-pressed={league === id}
          onClick={() => setLeague(id)}>{label}</button>
      ))}
    </div>
  )

  if (modelRows.length === 0) {
    return (
      <>
        <section className="toolbar">{leagueSeg}</section>
        <p className="empty-state">
          No {league === 'all' ? 'NFL or CFB model' : STRATEGY_LABEL[league]} bets yet. They are placed
          twelve hours before kickoff and appear here after the bot's next sync.
        </p>
      </>
    )
  }

  return (
    <>
      <section className="toolbar">{leagueSeg}</section>

      <Performance rows={modelRows} filters={filters} setFilters={setFilters}
        currency={currency} accountNames={accountNames} />

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Closing-line value</h2>
            <p className="muted">
              Whether the price taken beat the closing price. A few hundred bets in, this says more
              about the edge than profit does.
            </p>
          </div>
        </header>
        <div className="cards pad-cards">
          <Card label="Average CLV" value={pct(s.avgClv, { digits: 2 })} valueTone={tone(s.avgClv)}
            sub={s.bets ? `Over ${Math.round(s.clvCoverage * s.bets)} of ${s.bets} settled bets` : 'No settled bets'} />
          <Card label="Beat the close" value={pct(s.beatClose, { digits: 1 })}
            valueTone={s.beatClose == null ? '' : tone(s.beatClose - 50)}
            sub="Share of bets priced better than the close" />
          <Card label="Open" value={s.openCount.toLocaleString('en-CA')}
            sub="Waiting on a result" />
        </div>
      </section>

      {/* A segment, not .tabs: on phones .tabs is the fixed bottom bar. */}
      <section className="toolbar">
        <div className="seg" role="group" aria-label="Model bets">
          {[['graded', 'Graded'], ['pending', `Pending (${s.openCount})`]].map(([id, label]) => (
            <button key={id} className={list === id ? 'on' : ''} aria-pressed={list === id}
              onClick={() => setList(id)}>{label}</button>
          ))}
        </div>
      </section>
      {list === 'graded'
        ? <Graded rows={modelRows} currency={currency} accountNames={accountNames} />
        : <Pending rows={modelRows} currency={currency} accountNames={accountNames} />}
    </>
  )
}
