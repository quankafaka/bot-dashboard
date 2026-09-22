import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, configError } from './supabase'
import { fetchWagers, fetchAccounts, fetchBooks } from './lib/data'
import { accountBalance } from './lib/metrics'
import { money } from './lib/format'
import Login from './components/Login'
import Performance from './components/Performance'
import Pending from './components/Pending'
import Graded from './components/Graded'
import Daily from './components/Daily'
import { OddsProvider, useOddsFormat } from './lib/odds'

const REFRESH_MS = 60_000

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
  const [tab, setTab] = useState('performance')
  const [filters, setFilters] = useState({
    book: null, period: '30d', accounts: [], includeManual: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [w, a, b] = await Promise.all([fetchWagers(), fetchAccounts(), fetchBooks()])
      setRows(w)
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
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const book = books?.find((b) => b.name === filters.book)
  const bookRows = useMemo(() => (rows ?? []).filter((r) => r.book === filters.book), [rows, filters.book])
  const openCount = bookRows.filter((r) => r.status === 'pending').length
  const bal = useMemo(() => accountBalance(bookRows, book), [bookRows, book])

  const setBook = (name) => setFilters((f) => ({ ...f, book: name, accounts: [] }))

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
        ].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''}
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
          {tab === 'performance' && (
            <Performance rows={bookRows} filters={filters} setFilters={setFilters}
              currency={book.currency} accountNames={accounts} />
          )}
          {tab === 'daily' && (
            <Daily rows={bookRows} filters={filters} setFilters={setFilters}
              currency={book.currency} accountNames={accounts} />
          )}
          {tab === 'pending' && <Pending rows={bookRows} currency={book.currency} accountNames={accounts} />}
          {tab === 'graded' && <Graded rows={bookRows} currency={book.currency} accountNames={accounts} />}
        </main>
      )}
    </div>
  )
}