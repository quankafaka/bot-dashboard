import { useMemo, useState } from 'react'
import { MODEL_STRATEGIES, STRATEGY_LABEL, applyFilters, summarize, againstModel } from '../lib/metrics'
import { pct, tone } from '../lib/format'
import Performance from './Performance'
import Pending from './Pending'
import Graded from './Graded'
import { Card } from './Daily'
import Hint from './Hint'

// The bets placed by the NFL / CFB derivative models on the selected book
// (BetInAsian or Mise-o-jeu), on their own. The same numbers as the Overview
// tab (profit, yield, expected yield, the chart, the split-by table), over
// model bets only -- plus closing-line value, which both model repos say is
// what the first season should be judged on. The Overview tab still shows
// everything: the model and the steam chaser share each book's accounts.
// What the yield, CLV and beat-close figures are measured against.
// Model price first and by default.
const BASES = [
  ['model', 'Model price'],
  ['pinnacle', "Pinnacle's close"],
]

const LEAGUES = [
  ['all', 'NFL + CFB'],
  ['nfl_model', 'NFL'],
  ['cfb_model', 'CFB'],
]

export default function Models({ rows, filters, setFilters, currency, accountNames, labelsReady }) {
  const [league, setLeague] = useState('all')
  const [list, setList] = useState('graded')
  const [basis, setBasis] = useState('model')

  const leagueRows = useMemo(() => rows.filter((r) => MODEL_STRATEGIES.includes(r.strategy)
    && (league === 'all' || r.strategy === league)), [rows, league])
  // On the Model side every bet's CLV and expected profit are measured against
  // the model's fair price instead; everything below reads them from the rows.
  const modelRows = useMemo(() => (basis === 'model' ? againstModel(leagueRows) : leagueRows),
    [leagueRows, basis])
  const s = useMemo(() => summarize(applyFilters(modelRows, filters)), [modelRows, filters])
  // Average CLV stays on Pinnacle's close whichever side the switch is on:
  // against the model price it is only the edge the model saw at placement.
  const pin = useMemo(() => summarize(applyFilters(leagueRows, filters)), [leagueRows, filters])
  const priced = leagueRows.some((r) => r.model_price != null)
  const term = (t) => (basis === 'model' ? `${t} (model)` : t)

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

  const basisSeg = (
    <div className="seg" role="group" aria-label="Measured against">
      {BASES.map(([id, label]) => (
        <button key={id} className={basis === id ? 'on' : ''} aria-pressed={basis === id}
          onClick={() => setBasis(id)}>{label}</button>
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
      <section className="toolbar">{leagueSeg}{basisSeg}</section>
      {basis === 'model' && !priced && (
        <p className="muted">
          No model prices to measure against yet. They come from migration 011
          (<code>v_wager_model</code>); run it in Supabase and press Refresh.
        </p>
      )}

      <Performance rows={modelRows} filters={filters} setFilters={setFilters}
        currency={currency} accountNames={accountNames} basis={basis} showBeforeAfter={false} />

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>{basis === 'model' ? 'Value against the model price' : 'Closing-line value'}</h2>
            <p className="muted">
              {basis === 'model'
                ? "How much better the price taken was than the model's fair price for the bet. The model price is fixed when the bet is placed, so this is the edge the model saw, not a closing-line test."
                : 'Whether the price taken beat the closing price. A few hundred bets in, this says more about the edge than profit does.'}
            </p>
          </div>
        </header>
        <div className="cards pad-cards">
          <Card label={<Hint term="Avg CLV">Average CLV</Hint>} value={pct(pin.avgClv, { digits: 2 })}
            valueTone={tone(pin.avgClv)}
            sub={pin.bets
              ? `Against Pinnacle's close, over ${Math.round(pin.clvCoverage * pin.bets)} of ${pin.bets} settled bets`
              : 'No settled bets'} />
          <Card label={<Hint term={term('Beat close')}>{basis === 'model' ? 'Beat the model' : 'Beat the close'}</Hint>}
            value={pct(s.beatClose, { digits: 1 })}
            valueTone={s.beatClose == null ? '' : tone(s.beatClose - 50)}
            sub={basis === 'model' ? "Share of bets priced better than the model's fair price" : 'Share of bets priced better than the close'} />
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