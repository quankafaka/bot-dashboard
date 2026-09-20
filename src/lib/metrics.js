// Pure functions over v_wager rows. No React in here, so they can be tested
// with plain Node.

export const PERIODS = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: 'all', label: 'All time', days: null },
]

export function applyFilters(rows, f, now = Date.now()) {
  const period = PERIODS.find((p) => p.id === f.period)
  const since = period?.days ? now - period.days * 86_400_000 : null
  return rows.filter((r) =>
    r.book === f.book
    && (f.accounts.length === 0 || f.accounts.includes(r.account))
    && (f.includeManual || r.source === 'bot')
    && (since == null || r.placedMs >= since))
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0)

export function summarize(rows) {
  const graded = rows.filter((r) => r.status === 'graded')
  const open = rows.filter((r) => r.status !== 'graded')
  const withClv = graded.filter((r) => r.clv_pct != null)
  const withExp = graded.filter((r) => r.expected_profit != null)
  const turnover = sum(graded.map((r) => r.stake))
  const profit = sum(graded.map((r) => r.profit ?? 0))
  return {
    bets: graded.length,
    turnover,
    profit,
    roi: turnover ? (profit / turnover) * 100 : null,
    avgClv: withClv.length ? sum(withClv.map((r) => r.clv_pct)) / withClv.length : null,
    beatClose: withClv.length ? (withClv.filter((r) => r.clv_pct > 0).length / withClv.length) * 100 : null,
    clvCoverage: graded.length ? withClv.length / graded.length : 0,
    expected: sum(withExp.map((r) => r.expected_profit)),
    expCoverage: graded.length ? withExp.length / graded.length : 0,
    expYield: expYield(withExp),
    openCount: open.length,
    openStake: sum(open.map((r) => r.stake)),
    unlogged: open.filter((r) => r.status === 'unlogged').length,
  }
}

// One point per settled bet, in the order they were placed. Expected profit
// is what the edge alone should have earned; the gap between the two lines
// is variance.
export function cumulative(rows) {
  let p = 0
  let e = 0
  return rows
    .filter((r) => r.status === 'graded')
    .sort((a, b) => a.placedMs - b.placedMs)
    .map((r, i) => {
      p += r.profit ?? 0
      e += r.expected_profit ?? 0
      return { n: i + 1, date: r.placed_date_local, profit: round2(p), expected: round2(e) }
    })
}

export const SOURCE_LABEL = {
  bot: 'Bot',
  manual_log: 'Logged by hand',
  bia_order: 'BetInAsia only',
}

export const DIMENSIONS = [
  { id: 'sport', label: 'Sport', key: (r) => r.sport },
  { id: 'league', label: 'League', key: (r) => r.league },
  { id: 'country', label: 'Country', key: (r) => r.country },
  { id: 'market', label: 'Market', key: (r) => marketLabel(r) },
  { id: 'account', label: 'Account', key: (r) => r.account },
  { id: 'source', label: 'Recorded by', key: (r) => SOURCE_LABEL[r.source] ?? r.source },
  { id: 'odds', label: 'Odds band', key: (r) => oddsBand(r.price_filled) },
]

export function breakdown(rows, dimId) {
  const dim = DIMENSIONS.find((d) => d.id === dimId)
  const groups = new Map()
  for (const r of rows.filter((x) => x.status === 'graded')) {
    const k = dim.key(r) ?? '—'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  return [...groups.entries()]
    .map(([key, rs]) => ({ key, ...summarize(rs) }))
    .sort((a, b) => b.turnover - a.turnover)
}

export function marketLabel(r) {
  const base = {
    moneyline_2way: 'Moneyline',
    moneyline_3way: '1X2',
    spread: 'Handicap',
    total: 'Total',
  }[r.market_type] ?? r.market_type
  return r.variant && r.variant !== 'main' ? `${base} (${r.variant})` : base
}

export function oddsBand(o) {
  if (o == null) return '—'
  if (o < 1.6) return 'Under 1.60'
  if (o < 2.0) return '1.60–1.99'
  if (o < 2.5) return '2.00–2.49'
  if (o < 3.5) return '2.50–3.49'
  return '3.50 and up'
}

const round2 = (x) => Math.round(x * 100) / 100

// Expected profit over the stake of the bets that have one. Bets with no
// fair price logged (BetInAsia-only rows) are left out rather than counted
// as zero, which would drag the figure down.
function expYield(rows) {
  const stake = sum(rows.map((r) => r.stake))
  return stake ? (sum(rows.map((r) => r.expected_profit)) / stake) * 100 : null
}

// ---- daily / weekly -------------------------------------------------------
// Days are Montreal calendar days, matching v_wager.placed_date_local.
// Weeks run Monday to Sunday. Date strings are 'YYYY-MM-DD'.
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' })

export function localToday(now = new Date()) {
  return ymdFmt.format(now)
}

export function addDays(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function weekStart(ymd) {
  const dow = (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
  return addDays(ymd, -dow)
}

// Handle and wager count include bets still open; profit, yield and CLV only
// count settled ones, so an open bet never drags yield down.
function dayStats(rs) {
  const graded = rs.filter((r) => r.status === 'graded')
  const withClv = graded.filter((r) => r.clv_pct != null)
  const settledHandle = sum(graded.map((r) => r.stake))
  const profit = sum(graded.map((r) => r.profit ?? 0))
  return {
    wagers: rs.length,
    handle: sum(rs.map((r) => r.stake)),
    open: rs.length - graded.length,
    settled: graded.length,
    profit,
    yield: settledHandle ? (profit / settledHandle) * 100 : null,
    avgClv: withClv.length ? sum(withClv.map((r) => r.clv_pct)) / withClv.length : null,
    expected: sum(graded.map((r) => r.expected_profit ?? 0)),
    expYield: expYield(graded.filter((r) => r.expected_profit != null)),
  }
}

export function week(rows, start) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const byDay = new Map(days.map((d) => [d, []]))
  for (const r of rows) byDay.get(r.placed_date_local)?.push(r)
  return {
    days: days.map((date) => ({ date, ...dayStats(byDay.get(date)) })),
    total: dayStats(days.flatMap((d) => byDay.get(d))),
  }
}

// Balance = starting balance + profit of every settled bet placed since the
// start day. Ignores the page filters on purpose: it is the whole account.
export function accountBalance(rows, book) {
  if (!book || book.startingBalance == null) return null
  const since = book.balanceStart ?? '0000-00-00'
  const inScope = rows.filter((r) => r.placed_date_local >= since)
  return {
    balance: book.startingBalance + sum(inScope.filter((r) => r.status === 'graded').map((r) => r.profit ?? 0)),
    inPlay: sum(inScope.filter((r) => r.status === 'pending').map((r) => r.stake)),
    startingBalance: book.startingBalance,
    since,
  }
}
