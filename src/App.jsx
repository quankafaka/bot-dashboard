import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, configError } from './supabase'
import { fetchWagers, fetchAccounts, fetchBooks, fetchStrategies, fetchLimits, fetchModelPrices } from './lib/data'
import { accountBalance } from './lib/metrics'
import { money } from './lib/format'
import Login from './components/Login'
import Performance from './components/Performance'
import Pending from './components/Pending'
import Graded from './components/Graded'
import Daily from './components/Daily'
import Models from './components/Models'
import PatchNotes from './components/PatchNotes'
import { OddsProvider, useOddsFormat } from './lib/odds'

// The NFL / CFB derivative models only bet on BetInAsian, so their page only
// exists there.
const MODEL_BOOK = 'BetInAsian'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (configError) return <p className="fatal">{configError}</p>
  if (session === undefined) return null
  if (!session) return <Login />
  return (
    <OddsProvider userId={session.user.id}>
      <Dashboard email={session.user.email} />
    </OddsProvider>
  )
}

function OddsToggle() {
  const { format, setFormat } = useOddsFormat()
  return (
    <div className="seg" role="group" aria-label="Odds format">
      {[['decimal', 'Decimal'], ['american', 'American']].map(([id, label]) => (
        <button key={id} className={format === id ? 'on' : ''} aria-pressed={format === id}
          onClick={() => setFormat(id)}>{label}</button>
      ))}
    </div>
  )
}

function Dashboard({ email }) {
  const [rows, setRows] = useState(null)
  const [accounts, setAccounts] = useState({})
  const [books, setBooks] = useState(null)
  const [error, setError] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [labelsReady, setLabelsReady] = useState(false)
  const [tab, setTab] = useState('performance')
  const [filters, setFilters] = useState({
    book: null, period: '30d', accounts: [], includeManual: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [w, a, b, labels, limits, models] = await Promise.all([
        fetchWagers(), fetchAccounts(), fetchBooks(email), fetchStrategies(), fetchLimits(),
        fetchModelPrices()])
      // Which system took each bet (migration 008). Missing label: 'steam'
      // for the bot's own and hand-logged rows, unattributed for BIA-only.
      for (const r of w) {
        r.strategy = labels?.get(r.wager_id) ?? (labels && r.source !== 'bia_order' ? 'steam' : null)
      }
      // Pinnacle's limit on each bet's market (migration 009). Left undefined
      // until that migration has run, which hides every limit view.
      for (const r of w) {
        const l = limits?.get(r.wager_id)
        r.pin_limit = l?.limit ?? null
        r.limit_source = l?.source ?? null
        r.limit_tier = l?.tier ?? null
      }
      // The NFL / CFB model's fair price and EV on its own bets (migration
      // 011). Null on every other bet, and on all of them until it has run.
      for (const r of w) {
        const m = models?.get(r.wager_id)
        r.model_price = m?.price ?? null
        r.model_ev_pct = m?.ev ?? null
      }
      setLabelsReady(labels != null)
      // Only the books this user may see (fetchBooks), so a restricted book's
      // bets never sit in memory for anyone else.
      const allowed = new Set(b.map((x) => x.name))
      setRows(w.filter((r) => allowed.has(r.book)))
      setAccounts(a)
      setBooks(b)
      // First load, or a book that was taken away: show the first one allowed.
      setFilters((f) => (b.some((x) => x.name === f.book) ? f
        : { ...f, book: b[0]?.name ?? null, accounts: [] }))
      setError(null)
      setLoadedAt(new Date())
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [email])

  // Loads once when the dashboard opens; after that only the Refresh button
  // reloads. No timer: each reload downloads the full history, which is what
  // was using up the Supabase egress quota.
  useEffect(() => {
    load()
  }, [load])

  const book = books?.find((b) => b.name === filters.book)
  const bookRows = useMemo(() => (rows ?? []).filter((r) => r.book === filters.book), [rows, filters.book])
  const openCount = bookRows.filter((r) => r.status === 'pending').length
  const bal = useMemo(() => accountBalance(bookRows, book), [bookRows, book])

  const setBook = (name) => setFilters((f) => ({ ...f, book: name, accounts: [] }))
  const showModels = filters.book === MODEL_BOOK
  // A book with no bot (Bet99): every bet was logged by hand, so the
  // 'include bets the bot did not record' switch would only hide all of them.
  const logOnly = bookRows.length > 0 && !bookRows.some((r) => r.source === 'bot')
  const viewFilters = logOnly ? { ...filters, includeManual: true } : filters
  const view = tab === 'models' && !showModels ? 'performance' : tab

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">SC</span>
          <h1>Steam chasing dashboard</h1>
        </div>
        <div className={`seg books ${books?.length === 1 ? 'single' : ''}`} role="tablist" aria-label="Book">
          {(books ?? []).map((b) => (
            <button key={b.name} role="tab" aria-selected={filters.book === b.name}
              className={filters.book === b.name ? 'on' : ''} onClick={() => setBook(b.name)}>
              {b.name} <span className="ccy">{b.currency}</span>
            </button>
          ))}
        </div>
        {bal && (
          <div className="balance" title={`${money(bal.startingBalance, book.currency)} on ${bal.since}, plus every settled bet since`}>
            <div>
              <span className="balance-label">Balance</span>
              <span className="balance-value">{money(bal.balance, book.currency)}</span>
            </div>
            <div>
              <span className="balance-label">In play</span>
              <span className="balance-value dim">{money(bal.inPlay, book.currency)}</span>
            </div>
          </div>
        )}
        <div className="who">
          <OddsToggle />
          <span className="stamp">
            <span className={`dot ${error ? 'bad' : ''}`} aria-hidden="true" />
            {loadedAt ? `Updated ${loadedAt.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}` : 'Loading'}
          </span>
          <button className="btn" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          <button className="btn" onClick={() => supabase.auth.signOut()} title={email}>Sign out</button>
        </div>
        {/* Phones: the same controls, folded into one button. */}
        <details className="menu">
          <summary className="btn icon" aria-label="Menu">⋯</summary>
          <div className="menu-panel">
            <OddsToggle />
            <span className="stamp">
              <span className={`dot ${error ? 'bad' : ''}`} aria-hidden="true" />
              {loadedAt ? `Updated ${loadedAt.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}` : 'Loading'}
            </span>
            <button className="btn" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
            <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out {email}</button>
          </div>
        </details>
      </header>

      <nav className="tabs" role="tablist" aria-label="View">
        {[
          ['performance', 'Overview'],
          ['daily', 'Daily'],
          ['pending', 'Pending'],
          ['graded', 'Graded'],
          ...(showModels ? [['models', 'NFL / CFB']] : []),
          ['notes', <><span className="long">Patch notes</span><span className="short">Notes</span></>],
        ].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'on' : ''}
            onClick={() => setTab(id)}>
            {label}{id === 'pending' && <span className="count">{openCount}</span>}
          </button>
        ))}
      </nav>

      {error && (
        <p className="error">
          Could not load wagers: {error}. Check that your user can read v_wager, then press Refresh.
        </p>
      )}
      {!rows && !error && <p className="muted pad">Loading wagers…</p>}
      {rows && books?.length === 0 && (
        <p className="empty-state">
          No bot has been shared with {email} yet. Ask Alex to give this account access.
        </p>
      )}

      {rows && book && (
        <main>
          {view === 'performance' && (
            <Performance rows={bookRows} filters={viewFilters} setFilters={setFilters}
              currency={book.currency} accountNames={accounts} />
          )}
          {view === 'daily' && (
            <Daily rows={bookRows} filters={viewFilters} setFilters={setFilters}
              currency={book.currency} accountNames={accounts} />
          )}
          {view === 'pending' && <Pending rows={bookRows} currency={book.currency} accountNames={accounts} />}
          {view === 'graded' && <Graded rows={bookRows} currency={book.currency} accountNames={accounts} />}
          {view === 'notes' && <PatchNotes />}
          {view === 'models' && (
            <Models rows={bookRows} filters={viewFilters} setFilters={setFilters}
              currency={book.currency} accountNames={accounts} labelsReady={labelsReady} />
          )}
        </main>
      )}
    </div>
  )
}