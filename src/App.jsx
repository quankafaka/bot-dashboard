import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, configError, isPublic } from './supabase'
import { fetchWagers, fetchAccounts, fetchAccountBalances, fetchBooks, fetchStrategies, fetchLimits, fetchModelPrices, fetchDevig, fetchPageAccess } from './lib/data'
import { accountBalance } from './lib/metrics'
import { money } from './lib/format'
import Login from './components/Login'
import Performance from './components/Performance'
import Pending from './components/Pending'
import Graded from './components/Graded'
import Daily from './components/Daily'
import Weekly, { Weeks } from './components/Weekly'
import Models from './components/Models'
import PatchNotes from './components/PatchNotes'
import Overall from './components/Overall'
import BookPicker from './components/BookPicker'
import OverallPending from './components/OverallPending'
import OverallDaily from './components/OverallDaily'
import NewBets from './components/NewBets'
import { OddsProvider, useOddsFormat } from './lib/odds'
import { DEVIG_BOOKS } from './components/AlertCell'

// The books the NFL / CFB derivative models bet on. Each book's page shows
// only its own model bets; the other books have no model and no such page.
const MODEL_BOOKS = ['BetInAsian', 'Mise-o-jeu']

// The Overall page heads the book dropdown, and is where the dashboard opens,
// for the people granted it in user_page_access. Not a real book name, so no
// book's bets ever match it.
const OVERALL = 'overall'

// The facts each bet carries from the side views (data.js), set on the rows
// in place: on the whole history at load, on just the new bets after.
function enrich(w, [labels, limits, models, devig]) {
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
  // How the bot made the fair price behind each bet's EV (migration 012):
  // the de-vig method and Pinnacle's price before and after it. Null on
  // older bets, hand-logged ones, and on all of them until it has run.
  // BetInAsian bets only (DEVIG_BOOKS): every other book's stay null.
  for (const r of w) {
    const d = DEVIG_BOOKS.includes(r.book) ? devig?.get(r.wager_id) : null
    r.devig_method = d?.method ?? null
    r.devig_price_before = d?.before ?? null
    r.devig_price_after = d?.after ?? null
    r.devig_market_prices = d?.market ?? null
    r.devig_pdrop_nvp = d?.pdropNvp ?? null
    r.devig_hold_pct = d?.hold ?? null
  }
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (configError) return <p className="fatal">{configError}</p>
  if (isPublic) return <OddsProvider userId={null}><Dashboard /></OddsProvider>
  if (session === undefined) return null
  if (!session) return <Login />
  return (
    <OddsProvider userId={session.user.id}>
      <Dashboard email={session.user.email} />
    </OddsProvider>
  )
}

// A crash inside one tab shows a message in that tab instead of unmounting
// the whole page (which leaves a blank screen). Keyed by tab, so switching
// tabs gives the boundary a fresh start.
class TabBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <p className="error">
        This tab hit an error: {this.state.error.message || String(this.state.error)}. Try another tab or press Refresh.
      </p>
    )
  }
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
  const [pages, setPages] = useState(new Set())
  const [error, setError] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [labelsReady, setLabelsReady] = useState(false)
  const [tab, setTab] = useState('performance')
  const [filters, setFilters] = useState({
    book: null, period: 'all', accounts: [], includeManual: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [w, a, b, labels, limits, models, devig, p, ab] = await Promise.all([
        fetchWagers(), fetchAccounts(), fetchBooks(), fetchStrategies(), fetchLimits(),
        fetchModelPrices(), fetchDevig(), fetchPageAccess(), fetchAccountBalances()])
      // Each account's own starting balance goes with the book it bets on
      // (migration 014), which then shows a balance per account.
      for (const book of b) {
        const tags = new Set(w.filter((r) => r.book === book.name).map((r) => r.account))
        book.accountBalances = ab.filter((x) => tags.has(x.tag))
      }
      enrich(w, [labels, limits, models, devig])
      setLabelsReady(labels != null)
      // Only the books this user may see (fetchBooks), so a restricted book's
      // bets never sit in memory for anyone else.
      const allowed = new Set(b.map((x) => x.name))
      setRows(w.filter((r) => allowed.has(r.book)))
      setAccounts(a)
      setBooks(b)
      setPages(p)
      // First load, or a book (or the Overall page) that was taken away: show
      // Overall if this user has it, else the first book allowed.
      const keep = (book) => b.some((x) => x.name === book) || (book === OVERALL && p.has(OVERALL))
      const first = p.has(OVERALL) && b.length ? OVERALL : b[0]?.name ?? null
      setFilters((f) => (keep(f.book) ? f : { ...f, book: first, accounts: [] }))
      setError(null)
      setLoadedAt(new Date())
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // Loads once when the dashboard opens; after that only the Refresh button
  // reloads the full history, which is what was using up the Supabase egress
  // quota. The timer below asks only for bets placed since the newest one
  // here, which is usually nothing.
  useEffect(() => {
    load()
  }, [load])

  // New bets, every 30 seconds while the page is in view (and as soon as it
  // comes back into view), added to the rows with their side-view facts.
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const checkNew = useCallback(async () => {
    const have = rowsRef.current
    if (!have?.length || !books?.length || document.hidden) return
    const newest = have.reduce((m, r) => Math.max(m, r.placedMs || 0), 0)
    try {
      const allowed = new Set(books.map((x) => x.name))
      const known = new Set(have.map((r) => r.wager_id))
      const fresh = (await fetchWagers({ since: new Date(newest).toISOString() }))
        .filter((r) => allowed.has(r.book) && !known.has(r.wager_id))
      if (!fresh.length) return
      const ids = fresh.map((r) => r.wager_id)
      enrich(fresh, await Promise.all([fetchStrategies(ids), fetchLimits(ids), fetchModelPrices(ids), fetchDevig(ids)]))
      setRows((cur) => {
        const ids = new Set(cur.map((r) => r.wager_id))
        const add = fresh.filter((r) => !ids.has(r.wager_id))
        return add.length ? [...cur, ...add] : cur
      })
    } catch (e) {
      console.warn('New-bet check failed; the next one, or Refresh, tries again.', e)
    }
  }, [books])

  useEffect(() => {
    const timer = setInterval(checkNew, 30_000)
    const onShow = () => { if (!document.hidden) checkNew() }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [checkNew])

  // A popup for each open bet that was not here before, whether the check
  // above or Refresh brought it in. None for the bets the first load finds.
  const seen = useRef(null)
  const [popups, setPopups] = useState([])
  useEffect(() => {
    if (!rows) return
    if (seen.current) {
      const fresh = rows.filter((r) => r.status === 'pending' && !seen.current.has(r.wager_id))
      if (fresh.length) setPopups((p) => [...fresh.sort((a, b) => b.placedMs - a.placedMs), ...p])
    } else {
      seen.current = new Set()
    }
    for (const r of rows) seen.current.add(r.wager_id)
  }, [rows])
  const closePopup = useCallback((id) => setPopups((p) => p.filter((r) => r.wager_id !== id)), [])

  const book = books?.find((b) => b.name === filters.book)
  const bookRows = useMemo(() => (rows ?? []).filter((r) => r.book === filters.book), [rows, filters.book])
  const bal = useMemo(() => accountBalance(bookRows, book), [bookRows, book])

  const setBook = (name) => setFilters((f) => ({ ...f, book: name, accounts: [] }))
  const canOverall = pages.has(OVERALL) && books?.length > 0
  const overall = canOverall && filters.book === OVERALL
  const showModels = MODEL_BOOKS.includes(filters.book)
  // A book with no bot (Bet99): every bet was logged by hand, so the
  // 'include bets the bot did not record' switch would only hide all of them.
  const logOnly = bookRows.length > 0 && !bookRows.some((r) => r.source === 'bot')
  const viewFilters = logOnly ? { ...filters, includeManual: true } : filters
  // Overall has only its Overview, Daily, Weekly and Pending; a book's other
  // tabs show its Overview there.
  const view = overall ? (['daily', 'weekly', 'pending'].includes(tab) ? tab : 'performance')
    : tab === 'models' && !showModels ? 'performance' : tab
  const openCount = (overall ? rows ?? [] : bookRows).filter((r) => r.status === 'pending').length
  // Open bets per book, for the sportsbook menu.
  const openCounts = useMemo(() => {
    const n = {}
    for (const r of rows ?? []) if (r.status === 'pending') n[r.book] = (n[r.book] ?? 0) + 1
    return n
  }, [rows])
  const allOpen = Object.values(openCounts).reduce((a, b) => a + b, 0)
  const tabs = overall ? [['performance', 'Overview'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['pending', 'Pending']] : [
    ['performance', 'Overview'],
    ['daily', 'Daily'],
    ['weekly', 'Weekly'],
    ['pending', 'Pending'],
    ['graded', 'Graded'],
    ...(showModels ? [['models', 'NFL / CFB']] : []),
    ['notes', <><span className="long">Patch notes</span><span className="short">Notes</span></>],
  ]

  return (
    <div className="shell">
      <NewBets bets={popups} books={books ?? []} accountNames={accounts} onClose={closePopup}
        onClear={() => setPopups([])}
        onOpen={(r) => { setBook(r.book); setTab('pending'); closePopup(r.wager_id) }} />
      <header className="top">
        <h1 className="sr-only">Steam chasing dashboard</h1>
        <BookPicker value={filters.book} onChange={setBook} books={books ?? []} openCounts={openCounts}
          overall={canOverall ? { value: OVERALL, label: 'Overall', openCount: allOpen } : null} />
        {bal && (
          <div className="balance" title={`${money(bal.startingBalance, book.currency)} on ${bal.since}, plus every settled bet since`}>
            {/* A shared book: one balance per person; Overall shows the total. */}
            {bal.accounts ? bal.accounts.map((x) => (
              <div key={x.tag} title={`${money(x.startingBalance, book.currency)} on ${x.since}, plus every settled bet since`}>
                <span className="balance-label">{accounts[x.tag] ?? x.tag}</span>
                <span className="balance-value">{money(x.balance, book.currency)}</span>
              </div>
            )) : (
              <div>
                <span className="balance-label">Balance</span>
                <span className="balance-value">{money(bal.balance, book.currency)}</span>
              </div>
            )}
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
          {!isPublic && <button className="btn" onClick={() => supabase.auth.signOut()} title={email}>Sign out</button>}
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
            {!isPublic && <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out {email}</button>}
          </div>
        </details>
      </header>

      <nav className="tabs" role="tablist" aria-label="View">
        {tabs.map(([id, label]) => (
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

      {rows && overall && (
        <main>
          <TabBoundary key={`${view}:${OVERALL}`}>
            {view === 'performance' && <Overall rows={rows} books={books} accountNames={accounts} />}
            {view === 'daily' && <OverallDaily rows={rows} books={books} />}
            {view === 'weekly' && <OverallDaily rows={rows} books={books} View={Weeks} />}
            {view === 'pending' && <OverallPending rows={rows} books={books} accountNames={accounts} />}
          </TabBoundary>
        </main>
      )}

      {rows && book && (
        <main>
          <TabBoundary key={`${view}:${filters.book}`}>
          {view === 'performance' && (
            <Performance rows={bookRows} filters={viewFilters} setFilters={setFilters}
              currency={book.currency} accountNames={accounts} />
          )}
          {view === 'daily' && (
            <Daily rows={bookRows} filters={viewFilters} setFilters={setFilters}
              currency={book.currency} accountNames={accounts} />
          )}
          {view === 'weekly' && (
            <Weekly rows={bookRows} filters={viewFilters} setFilters={setFilters}
              currency={book.currency} accountNames={accounts} />
          )}
          {view === 'pending' && <Pending rows={bookRows} currency={book.currency} accountNames={accounts} />}
          {view === 'graded' && <Graded rows={bookRows} currency={book.currency} accountNames={accounts} />}
          {view === 'notes' && <PatchNotes />}
          {view === 'models' && (
            <Models rows={bookRows} filters={viewFilters} setFilters={setFilters}
              currency={book.currency} accountNames={accounts} labelsReady={labelsReady} />
          )}
          </TabBoundary>
        </main>
      )}
    </div>
  )
}