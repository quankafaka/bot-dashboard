// Pure functions over v_wager rows. No React in here, so they can be tested
// with plain Node.

export const PERIODS = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: 'all', label: 'All time', days: null },
]

function periodSince(periodId, now) {
  const period = PERIODS.find((p) => p.id === periodId)
  return period?.days ? now - period.days * 86_400_000 : null
}

export function applyFilters(rows, f, now = Date.now()) {
  const since = periodSince(f.period, now)
  return rows.filter((r) =>
    r.book === f.book
    && (f.accounts.length === 0 || f.accounts.includes(r.account))
    && (f.includeManual || r.source === 'bot')
    && (since == null || r.placedMs >= since))
}

// ---- the Overall page -----------------------------------------------------
// Every book the user can see, pooled by currency: the CAD books add up
// together, USD on its own, never one into the other. CAD comes first (the
// Overall page opens on it), then the rest in the books' own order; each
// group lists its books in that order too.
const CURRENCY_FIRST = 'CAD'

export function currencyGroups(books) {
  const groups = new Map()
  for (const b of books) {
    if (!groups.has(b.currency)) groups.set(b.currency, [])
    groups.get(b.currency).push(b)
  }
  return [...groups.entries()]
    .map(([currency, bs]) => ({ currency, books: bs }))
    .sort((a, b) => (b.currency === CURRENCY_FIRST) - (a.currency === CURRENCY_FIRST))
}

// Only the period: the account and recorded-by filters belong to one book,
// and the Overall page counts every bet that moved money.
export function applyPeriod(rows, periodId, now = Date.now()) {
  const since = periodSince(periodId, now)
  return since == null ? rows : rows.filter((r) => r.placedMs >= since)
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0)

// The NFL / CFB tab's "Model price" switch. Each bet's expected profit is
// measured against the model's own fair price (r.model_price, the price it
// said the bet was worth when it was placed) instead of Pinnacle's closing
// no-vig price, and model_edge_pct records the price taken against that fair
// price (what "Beat the model" counts). CLV (clv_pct) is left alone: it is
// always Pinnacle's close, on both sides of the switch.
//
// The same arithmetic as the Pinnacle side (pdropper's CLV): the price taken
// over the fair price, minus one, before commission; expected profit is stake
// times that. A bet with no model price gets neither, and is left out of the
// expected figures the way a bet with no closing line is. The model price
// never moves after the bet, so nearly every bet "beats" it: the bot only
// bets when it does.
export function againstModel(rows) {
  return rows.map((r) => {
    const fair = r.model_price
    if (!(fair > 1) || !(r.price_filled > 1)) {
      return { ...r, model_edge_pct: null, expected_profit: null }
    }
    const edge = (r.price_filled / fair - 1) * 100
    return { ...r, model_edge_pct: edge, expected_profit: r.stake * edge / 100 }
  })
}

export function summarize(rows) {
  const graded = rows.filter((r) => r.status === 'graded')
  // Open = still waiting on a result. 'unlogged' bets are NOT open: their game
  // is over, they just never reached pdropper, so they are not money at risk.
  const open = rows.filter((r) => r.status === 'pending')
  const withClv = graded.filter((r) => r.clv_pct != null)
  const withExp = graded.filter((r) => r.expected_profit != null)
  const withEvLog = graded.filter((r) => r.ev_pct_log != null)
  // Only set on the NFL / CFB tab's Model price side (againstModel).
  const withEdge = graded.filter((r) => r.model_edge_pct != null)
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
    beatModel: withEdge.length ? (withEdge.filter((r) => r.model_edge_pct > 0).length / withEdge.length) * 100 : null,
    // The EV pdropper logged when the bet was taken; every bet counts the same.
    avgEvLog: withEvLog.length ? sum(withEvLog.map((r) => r.ev_pct_log)) / withEvLog.length : null,
    expected: sum(withExp.map((r) => r.expected_profit)),
    expCoverage: graded.length ? withExp.length / graded.length : 0,
    expYield: expYield(withExp),
    openCount: open.length,
    openStake: sum(open.map((r) => r.stake)),
    unlogged: rows.filter((r) => r.status === 'unlogged').length,
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

// The derivative-model systems, by the label the bot records. Everything
// else is the steam chaser; a NULL label is a bet nothing could attribute
// (a BetInAsia-only order).
export const MODEL_STRATEGIES = ['nfl_model', 'cfb_model']

export const STRATEGY_LABEL = {
  steam: 'Steam alerts',
  nfl_model: 'NFL model',
  cfb_model: 'CFB model',
}

export const isModel = (r) => MODEL_STRATEGIES.includes(r.strategy)

export const DIMENSIONS = [
  { id: 'sport', label: 'Sport', key: (r) => r.sport },
  { id: 'league', label: 'League', key: (r) => r.league },
  { id: 'country', label: 'Country', key: (r) => r.country },
  { id: 'market', label: 'Market', key: (r) => marketLabel(r) },
  { id: 'account', label: 'Account', key: (r) => r.account },
  { id: 'source', label: 'Recorded by', key: (r) => SOURCE_LABEL[r.source] ?? r.source },
  { id: 'strategy', label: 'System', key: (r) => STRATEGY_LABEL[r.strategy] ?? 'Unattributed' },
  { id: 'odds', label: 'Odds band', key: (r) => oddsBand(r.price_filled) },
  // Shown once v_wager_limit has data (needsLimits).
  { id: 'limit', label: 'Pinnacle limit', key: (r) => limitBand(r.pin_limit),
    order: () => LIMIT_BAND_ORDER, needsLimits: true },
]

export function breakdown(rows, dimId) {
  const dim = DIMENSIONS.find((d) => d.id === dimId)
  const groups = new Map()
  for (const r of rows.filter((x) => x.status === 'graded')) {
    const k = dim.key(r) ?? '—'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  const out = [...groups.entries()].map(([key, rs]) => ({ key, ...summarize(rs) }))
  if (dim.order) {
    // Bands read in their own order (thin to deep), not by handle.
    const order = dim.order()
    const at = (k) => (order.includes(k) ? order.indexOf(k) : order.length)
    return out.sort((a, b) => at(a.key) - at(b.key))
  }
  return out.sort((a, b) => b.turnover - a.turnover)
}

// Two-level splits: every group of the outer dimension, with its rows split
// again by the inner one (e.g. Total, then soccer / basketball / hockey).
export const NESTED_DIMENSIONS = [
  { id: 'market_sport', label: 'Market by sport', outer: 'market', inner: 'sport' },
]

export function breakdownNested(rows, outerId, innerId) {
  const outer = DIMENSIONS.find((d) => d.id === outerId)
  const groups = new Map()
  for (const r of rows.filter((x) => x.status === 'graded')) {
    const k = outer.key(r) ?? '—'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  return [...groups.entries()]
    .map(([key, rs]) => ({ key, ...summarize(rs), children: breakdown(rs, innerId) }))
    .sort((a, b) => b.turnover - a.turnover)
}

// ---- open bets: what is riding on what -----------------------------------
// The Pending tab's split. Handle is the stake on open bets; to win is what
// they pay over the stake if they all land: stake times the odds less one
// (a free bet's stake does not come back, so the same figure holds). Falls
// back to to_return when a bet has no price.
export const toWin = (r) => {
  if (r.price_filled > 1) return r.stake * (r.price_filled - 1)
  return r.to_return != null ? r.to_return - r.stake : 0
}

const gameKey = (r) => `${r.home_team} v ${r.away_team}|${r.start_time ?? ''}`

export const EXPOSURE_DIMENSIONS = [
  { id: 'sport', label: 'Sport', key: (r) => r.sport },
  { id: 'league', label: 'League', key: (r) => r.league },
  { id: 'market', label: 'Market', key: (r) => marketLabel(r) },
  { id: 'game', label: 'Game', key: gameKey },
  // Only offered when the tab shows more than one website.
  { id: 'book', label: 'Website', key: (r) => r.book },
]

// The EV of a set of bets, each weighted by its stake: a $300 bet at +4%
// counts three times a $100 one. Bets with no EV (hand-logged ones, or no
// price now) are left out of both sums rather than counted as zero.
export function stakeWeighted(rows, field) {
  const has = rows.filter((r) => r[field] != null && r.stake)
  const stake = sum(has.map((r) => r.stake))
  return stake ? sum(has.map((r) => r.stake * r[field])) / stake : null
}

// One row per group: bets, handle, to win, and the stake-weighted EV at log
// and now. Games carry their teams, league and start for the label, and read
// soonest first; the rest by handle.
export function exposure(rows, dimId) {
  const dim = EXPOSURE_DIMENSIONS.find((d) => d.id === dimId)
  const groups = new Map()
  for (const r of rows) {
    const k = dim.key(r) ?? '—'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  const out = [...groups.entries()].map(([key, rs]) => ({
    key,
    bets: rs.length,
    handle: sum(rs.map((r) => r.stake ?? 0)),
    toWin: sum(rs.map(toWin)),
    evLog: stakeWeighted(rs, 'ev_pct_log'),
    evNow: stakeWeighted(rs, 'current_ev_pct'),
    game: dimId === 'game' ? rs[0] : null,
  }))
  if (dimId === 'game') {
    return out.sort((a, b) => (a.game.startMs ?? Infinity) - (b.game.startMs ?? Infinity) || b.handle - a.handle)
  }
  return out.sort((a, b) => b.handle - a.handle)
}

export const exposureKey = (dimId, r) => EXPOSURE_DIMENSIONS.find((d) => d.id === dimId).key(r) ?? '—'

// ---- handle placed over time ----------------------------------------------
// The Overall Pending tab's chart, every system together: the last day as a
// rolling hour, moved on every 10 minutes so the line runs smooth; the last
// week by Montreal calendar day.
const HOUR = 3_600_000
export const HANDLE_RANGES = [
  { id: '24h', label: '24 hours', step: HOUR / 6, buckets: 144, window: 6 },
  { id: '7d', label: '7 days', step: 24 * HOUR, buckets: 7, window: 1 },
]

// One point per step of the range, oldest first, the step now running last:
// the stake put down in the `window` steps up to and including it (the hour
// to then, for the day; the day itself, for the week).
// prevHandle / prevBets are the same point one range earlier, to lay over it.
// handle / bets / prevHandle on the result are the whole range's totals.
// Every bet placed counts, whatever has become of it since. Steps start on
// the local clock: offsetMs is the zone's offset from UTC (-4 h in Montreal
// summer).
export function handleSeries(rows, rangeId, now = Date.now(), offsetMs = 0) {
  const { step, buckets, window } = HANDLE_RANGES.find((r) => r.id === rangeId)
  const span = step * buckets
  const last = Math.floor((now + offsetMs) / step) * step - offsetMs
  const first = last - (buckets - 1) * step
  const start = first - (window - 1) * step // the first point's window reaches back this far
  const size = buckets + window - 1
  const cur = Array.from({ length: size }, () => ({ handle: 0, bets: 0 }))
  const prev = Array.from({ length: size }, () => ({ handle: 0, bets: 0 }))
  const totals = { handle: 0, bets: 0, prevHandle: 0 }
  const add = (raw, ms, r) => {
    if (ms < start) return
    const b = raw[Math.floor((ms - start) / step)]
    if (!b) return
    b.handle += r.stake ?? 0
    b.bets += 1
  }
  for (const r of rows) {
    if (!(r.placedMs >= start - span) || r.placedMs > now) continue
    add(cur, r.placedMs, r)
    add(prev, r.placedMs + span, r)
    if (r.placedMs >= first) { totals.handle += r.stake ?? 0; totals.bets += 1 }
    else if (r.placedMs >= first - span) totals.prevHandle += r.stake ?? 0
  }
  const roll = (raw, i, k) => raw.slice(i, i + window).reduce((t, b) => t + b[k], 0)
  const points = Array.from({ length: buckets }, (_, i) => ({
    ms: first + i * step,
    handle: round2(roll(cur, i, 'handle')),
    bets: roll(cur, i, 'bets'),
    prevHandle: round2(roll(prev, i, 'handle')),
    prevBets: roll(prev, i, 'bets'),
  }))
  return { points, handle: round2(totals.handle), bets: totals.bets, prevHandle: round2(totals.prevHandle) }
}

// ---- handle over a calendar month ------------------------------------------
// The Overall Pending tab's month chart: handle placed so far in a Montreal
// calendar month (placed_date_local), running total day by day, every system
// together, with the month before laid over it day for day (the 1st on the
// 1st). ym is 'YYYY-MM'. The month's line stops at today; a line runs only as
// many days as its month has. handle / bets / prevHandle on the result are
// the months' totals.
export const prevMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}
const monthDays = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function monthCumulative(rows, ym, today = localToday()) {
  const pm = prevMonth(ym)
  const cur = new Array(monthDays(ym)).fill(0)
  const prev = new Array(monthDays(pm)).fill(0)
  const curBets = new Array(cur.length).fill(0)
  const prevBets = new Array(prev.length).fill(0)
  for (const r of rows) {
    const d = r.placed_date_local
    if (!d) continue
    const day = Number(d.slice(8, 10)) - 1
    if (d.startsWith(ym)) { cur[day] += r.stake ?? 0; curBets[day] += 1 }
    else if (d.startsWith(pm)) { prev[day] += r.stake ?? 0; prevBets[day] += 1 }
  }
  // The days of this month that have begun: all of a past month, none of a future one.
  const upTo = today.slice(0, 7) > ym ? cur.length : today.startsWith(ym) ? Number(today.slice(8, 10)) : 0
  const points = []
  let h = 0, b = 0, ph = 0, pb = 0
  for (let i = 0; i < Math.max(cur.length, prev.length); i++) {
    h += cur[i] ?? 0; b += curBets[i] ?? 0
    ph += prev[i] ?? 0; pb += prevBets[i] ?? 0
    points.push({
      day: i + 1,
      handle: i < upTo ? round2(h) : null, bets: i < upTo ? b : null,
      prevHandle: i < prev.length ? round2(ph) : null, prevBets: i < prev.length ? pb : null,
    })
  }
  return { points, handle: round2(sum(cur)), bets: sum(curBets), prevHandle: round2(sum(prev)) }
}

// The months the bets were placed in, 'YYYY-MM', newest first.
export const placedMonths = (rows) =>
  [...new Set(rows.map((r) => r.placed_date_local?.slice(0, 7)).filter(Boolean))].sort().reverse()

// ---- before / after a cutoff ----------------------------------------------
// The day the higher-EV limit rule took over (2026-10-06, see the patch
// notes). A bet placed ON that day counts as after.
export const LIMIT_CUTOFF = '2026-10-06'

// Settled bets placed before the cutoff day against those placed on or
// after it (Montreal calendar day, placed_date_local), as summarize() pairs:
// one for every bet, and one per group of dimId (a DIMENSIONS or
// NESTED_DIMENSIONS id).
export function compareAtCutoff(rows, cutoff, dimId) {
  const graded = rows.filter((r) => r.status === 'graded')
  const pair = (rs) => {
    const before = summarize(rs.filter((r) => r.placed_date_local < cutoff))
    const after = summarize(rs.filter((r) => r.placed_date_local >= cutoff))
    return { before, after, turnover: before.turnover + after.turnover }
  }
  const nested = NESTED_DIMENSIONS.find((d) => d.id === dimId)
  const group = (rs, id) => {
    const dim = DIMENSIONS.find((d) => d.id === id)
    const m = new Map()
    for (const r of rs) {
      const k = dim.key(r) ?? '—'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(r)
    }
    const out = [...m.entries()].map(([key, g]) => ({ key, rows: g, ...pair(g) }))
    if (dim.order) {
      const order = dim.order()
      const at = (k) => (order.includes(k) ? order.indexOf(k) : order.length)
      return out.sort((a, b) => at(a.key) - at(b.key))
    }
    return out.sort((a, b) => b.turnover - a.turnover)
  }
  const groups = group(graded, nested ? nested.outer : dimId).map(({ rows: g, ...rest }) => (
    nested ? { ...rest, children: group(g, nested.inner).map(({ rows: _, ...c }) => c) } : rest))
  return { total: pair(graded), groups }
}

// ---- the Pinnacle-limit rule (soccer, basketball, hockey) -----------------
// A mirror of the bot's r_limit_rules.SPORT_BANDS. If one changes, change
// the other: the bot decides with that table, this one only labels bets.
// Basketball and hockey use the soccer numbers (since 2026-10-07): spread as
// Asian handicap, total as goal totals, moneyline as 1X2. Corners and
// bookings are soccer only.
//   skipBelow:   limits under it are skipped
//   minEv:       under a limit of strictBelow, a bet needs this EV (after
//                commission) instead of the normal floor
// Every bet the rule lets through gets the full stake (since 2026-10-06; it
// used to halve the stake at middling limits -- 'reduced' on older bets).
export const BASE_MIN_EV = 1.0
export const LIMIT_RULE_BANDS = {
  ah: { label: 'Asian handicap', skipBelow: 150, minEv: 4.5, strictBelow: 400 },
  total: { label: 'Goal totals', skipBelow: 200, minEv: 2.5, strictBelow: 400 },
  ml: { label: '1X2', skipBelow: 300, minEv: 3.0, strictBelow: 500 },
  corners: { label: 'Corners', skipBelow: 125 },
  bookings: { label: 'Bookings', skipBelow: 125 },
}

// The sports the rule covers, as the sync writes them (title case, lowered
// here) plus the other spellings the bot accepts for hockey.
const LIMITED_SPORTS = new Set(['soccer', 'basketball', 'hockey', 'ice hockey',
  'ice-hockey', 'icehockey', 'nhl'])
// The rule only ever ran on the BetInAsian bot. Mise-o-jeu bets can carry a
// Pinnacle limit too (pdropper logs one), but the rule never judged them.
export const LIMIT_RULE_BOOK = 'BetInAsian'
const isSoccer = (r) => String(r.sport ?? '').trim().toLowerCase() === 'soccer'

export function limitRuleMarket(r) {
  if (r.variant && r.variant !== 'main') {
    return isSoccer(r) && LIMIT_RULE_BANDS[r.variant] ? r.variant : null
  }
  if (r.market_type === 'spread') return 'ah'
  if (r.market_type === 'total') return 'total'
  if (String(r.market_type ?? '').startsWith('moneyline')) return 'ml'
  return null
}

// Where the rule puts a bet's limit today: 'skip', 'higher' (needs the
// band's minEv) or 'normal' (the normal +1% floor). null when the rule says
// nothing (a sport it does not cover, no limit, no band for the market).
export function limitRuleBand(r) {
  if (r.book !== LIMIT_RULE_BOOK) return null
  if (!LIMITED_SPORTS.has(String(r.sport ?? '').trim().toLowerCase()) || r.pin_limit == null) return null
  const band = LIMIT_RULE_BANDS[limitRuleMarket(r)]
  if (!band) return null
  if (r.pin_limit < band.skipBelow) return 'skip'
  if (band.minEv != null && r.pin_limit < band.strictBelow) return 'higher'
  return 'normal'
}

// The EV the rule asks of this bet at its limit, or null for the normal floor.
export function limitRuleMinEv(r) {
  return limitRuleBand(r) === 'higher' ? LIMIT_RULE_BANDS[limitRuleMarket(r)].minEv : null
}

export const LIMIT_BAND_ORDER = [
  'Under $150', '$150–199', '$200–299', '$300–399', '$400–499', '$500–999', '$1,000 and up', '—',
]

// Cut where the rule cuts ($150, $200, $300, $400, $500), so a row here is
// never half one band, half another.
export function limitBand(x) {
  if (x == null) return '—'
  if (x < 150) return 'Under $150'
  if (x < 200) return '$150–199'
  if (x < 300) return '$200–299'
  if (x < 400) return '$300–399'
  if (x < 500) return '$400–499'
  if (x < 1000) return '$500–999'
  return '$1,000 and up'
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

// The market as the bet lists show it: marketLabel plus the period when it is
// not the whole game, so a first-half model bet does not read as a full-game
// one. Kept apart from marketLabel, which the split-by table groups on.
const WHOLE_GAME = new Set(['', 'game', 'match', 'full time', 'fulltime'])
export function betLabel(r) {
  const period = String(r.period ?? '').trim().toLowerCase()
  if (WHOLE_GAME.has(period)) return marketLabel(r)
  return `${marketLabel(r)}, ${period.charAt(0).toUpperCase()}${period.slice(1)}`
}

// The same bands, named in American odds.
export const ODDS_BAND_AMERICAN = {
  'Under 1.60': 'Shorter than -167',
  '1.60–1.99': '-167 to -101',
  '2.00–2.49': '+100 to +149',
  '2.50–3.49': '+150 to +249',
  '3.50 and up': '+250 and up',
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
    // Share of settled bets with a closing line that were priced better than
    // it, same rule as summarize(). clvCount is how many that is out of.
    beatClose: withClv.length ? (withClv.filter((r) => r.clv_pct > 0).length / withClv.length) * 100 : null,
    clvCount: withClv.length,
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
// A book shared by several people (book.accountBalances, migration 014) is
// each account's balance, from its own bets, added up; `accounts` lists them.
export function accountBalance(rows, book) {
  if (!book) return null
  if (book.accountBalances?.length) {
    const accounts = book.accountBalances.map((a) => ({
      tag: a.tag, ...accountBalance(rows.filter((r) => r.account === a.tag), a),
    }))
    return {
      balance: sum(accounts.map((a) => a.balance)),
      inPlay: sum(accounts.map((a) => a.inPlay)),
      startingBalance: sum(accounts.map((a) => a.startingBalance)),
      since: accounts[0].since,
      accounts,
    }
  }
  if (book.startingBalance == null) return null
  const since = book.balanceStart ?? '0000-00-00'
  const inScope = rows.filter((r) => r.placed_date_local >= since)
  return {
    balance: book.startingBalance + sum(inScope.filter((r) => r.status === 'graded').map((r) => r.profit ?? 0)),
    inPlay: sum(inScope.filter((r) => r.status === 'pending').map((r) => r.stake)),
    startingBalance: book.startingBalance,
    since,
  }
}

// The Overall page's balance: accountBalance added up over a currency's
// books. Books with no starting balance are left out, and counted in
// `missing` so the page can say the figure is short of them.
export function pooledBalance(rows, books) {
  const each = books.map((b) => accountBalance(rows.filter((r) => r.book === b.name), b))
  const known = each.filter(Boolean)
  if (!known.length) return null
  return {
    balance: sum(known.map((x) => x.balance)),
    inPlay: sum(known.map((x) => x.inPlay)),
    missing: books.filter((_, i) => !each[i]).map((b) => b.name),
  }
}