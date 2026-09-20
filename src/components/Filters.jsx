import { PERIODS } from '../lib/metrics'

export default function Filters({ rows, filters, setFilters, accountNames, showPeriod = true, children }) {
  const bookAccounts = [...new Set(rows.map((r) => r.account))].sort()
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const toggle = (a) => set({
    accounts: filters.accounts.includes(a) ? filters.accounts.filter((x) => x !== a) : [...filters.accounts, a],
  })
  return (
    <section className="toolbar" aria-label="Filters">
      {children}
      {showPeriod && (
        <div className="seg" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.id} className={filters.period === p.id ? 'on' : ''} aria-pressed={filters.period === p.id}
              onClick={() => set({ period: p.id })}>{p.label}</button>
          ))}
        </div>
      )}
      {bookAccounts.length > 1 && (
        <div className="seg" role="group" aria-label="Accounts">
          <button className={filters.accounts.length === 0 ? 'on' : ''} aria-pressed={filters.accounts.length === 0}
            onClick={() => set({ accounts: [] })}>All accounts</button>
          {bookAccounts.map((a) => (
            <button key={a} className={filters.accounts.includes(a) ? 'on' : ''}
              aria-pressed={filters.accounts.includes(a)} onClick={() => toggle(a)}>
              {accountNames[a] ?? a}
            </button>
          ))}
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={filters.includeManual}
          onChange={(e) => set({ includeManual: e.target.checked })} />
        Include bets the bot did not record
      </label>
    </section>
  )
}
