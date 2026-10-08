import { supabase } from '../supabase'

// Supabase's API returns at most 1,000 rows per request, so read in pages.
const PAGE = 1000

const BASE_COLUMNS = [
  'wager_id', 'source', 'status', 'placed_at', 'placed_date_local',
  'sport', 'league', 'country', 'home_team', 'away_team', 'start_time',
  'market_type', 'period', 'variant', 'book', 'currency', 'account',
  'selection', 'line', 'bet_ref', 'is_freebet',
  'price_filled', 'stake', 'to_return',
  'ev_pct_bot', 'ev_pct_log', 'clv_pct', 'expected_profit', 'current_ev_pct',
  'result', 'profit', 'home_score', 'away_score',
]
// Added by migrations 006 and 007. Until one has run its columns do not exist,
// and asking for them would fail the whole load -- so a missing-column error
// steps down to the next smaller set, and the alert column shows what it can.
const ALERT_COLUMNS = ['pin_price_before', 'pin_price_after', 'pin_drop_pct', 'closing_price']
const ALERT_SELECTION = ['alert_selection']

const NUMERIC = [...ALERT_COLUMNS,
  'line', 'price_filled', 'stake', 'to_return', 'ev_pct_bot', 'ev_pct_log',
  'clv_pct', 'expected_profit', 'current_ev_pct', 'profit']

async function readAll(columns) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('v_wager')
      .select(columns.join(','))
      .order('placed_at', { ascending: true })
      .order('wager_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

export async function fetchWagers() {
  const attempts = [
    [...BASE_COLUMNS, ...ALERT_COLUMNS, ...ALERT_SELECTION],
    [...BASE_COLUMNS, ...ALERT_COLUMNS],
    BASE_COLUMNS,
  ]
  let rows
  for (const columns of attempts) {
    try {
      rows = await readAll(columns)
      break
    } catch (e) {
      const missingColumn = e?.code === '42703' || /does not exist/i.test(e?.message ?? '')
      if (!missingColumn || columns === BASE_COLUMNS) throw e   // only a missing migration is excused
    }
  }
  // Postgres numerics arrive as strings; convert once here.
  for (const r of rows) {
    for (const k of NUMERIC) r[k] = r[k] == null ? null : Number(r[k])
    r.placedMs = Date.parse(r.placed_at)
    r.startMs = r.start_time ? Date.parse(r.start_time) : null
  }
  return rows
}

// Which system took each bet -- the steam chaser or the NFL / CFB models --
// from v_wager_strategy (migration 008), joined to v_wager rows on wager_id.
// Returns null, not an error, until that migration has run: the rest of the
// dashboard does not depend on it, so it must not fail the whole load.
export async function fetchStrategies() {
  const labels = new Map()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('v_wager_strategy')
      .select('wager_id,strategy')
      .order('wager_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      const missing = ['42P01', 'PGRST205'].includes(error.code)
        || /does not exist|could not find/i.test(error.message ?? '')
      if (missing) return null
      throw error
    }
    for (const r of data) labels.set(r.wager_id, r.strategy)
    if (data.length < PAGE) break
  }
  return labels
}

// Pinnacle's limit on each bet's market, from v_wager_limit (migration 009):
// read by the bot for soccer since the limit rule went in, pdropper's logged
// limit for everything else. Returns null, not an error, until that migration
// has run -- like fetchStrategies, nothing else on the page depends on it.
export async function fetchLimits() {
  const limits = new Map()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('v_wager_limit')
      .select('wager_id,pinnacle_limit,limit_source,limit_tier')
      .order('wager_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      const missing = ['42P01', 'PGRST205'].includes(error.code)
        || /does not exist|could not find/i.test(error.message ?? '')
      if (missing) return null
      throw error
    }
    for (const r of data) {
      limits.set(r.wager_id, {
        limit: r.pinnacle_limit == null ? null : Number(r.pinnacle_limit),
        source: r.limit_source,
        tier: r.limit_tier,
      })
    }
    if (data.length < PAGE) break
  }
  return limits
}

// The NFL / CFB models' own fair price on each bet, from v_wager_model
// (migration 011): what the model said the bet was worth, and the EV it saw at
// the price it priced. The bot writes the model's fair price where a steam
// bet keeps Pinnacle's no-vig one (wagers.csv pinnacle_novig -> fact_wager
// pin_novig), so this view only hands it out for model bets. Returns null,
// not an error, until the migration has run.
export async function fetchModelPrices() {
  const prices = new Map()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('v_wager_model')
      .select('wager_id,model_price,model_ev_pct')
      .order('wager_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      const missing = ['42P01', 'PGRST205'].includes(error.code)
        || /does not exist|could not find/i.test(error.message ?? '')
      if (missing) return null
      throw error
    }
    for (const r of data) {
      prices.set(r.wager_id, {
        price: r.model_price == null ? null : Number(r.model_price),
        ev: r.model_ev_pct == null ? null : Number(r.model_ev_pct),
      })
    }
    if (data.length < PAGE) break
  }
  return prices
}

export async function fetchAccounts() {
  const { data, error } = await supabase.from('dim_account').select('tag, description')
  if (error) throw error
  return Object.fromEntries(data.map((a) => [a.tag, a.description || a.tag]))
}

// The books this user may see, as granted in user_book_access (the database
// only returns those). Balance columns come from migration 003.
const BOOK_ORDER = ['BetInAsian', 'Mise-o-jeu', 'Bet99']
const rank = (name) => (BOOK_ORDER.includes(name) ? BOOK_ORDER.indexOf(name) : BOOK_ORDER.length)

// Books only some people may see. The real gate is user_book_access
// (migration 010 grants Bet99 to these two); this list only keeps the tab
// hidden from anyone else should the database ever hand them the book. Adding
// a person means adding them in BOTH places.
const RESTRICTED_BOOKS = {
  Bet99: ['gilbert.oi@hotmail.com', 'alexquanfafa@gmail.com'],
}
const maySee = (name, email) =>
  !RESTRICTED_BOOKS[name] || RESTRICTED_BOOKS[name].includes(String(email ?? '').toLowerCase())

export async function fetchBooks(email) {
  const { data, error } = await supabase.from('dim_book').select('*')
  if (error) throw error
  return data
    .filter((b) => maySee(b.name, email))
    .map((b) => ({
      name: b.name,
      currency: b.currency,
      startingBalance: b.starting_balance == null ? null : Number(b.starting_balance),
      balanceStart: b.balance_start ?? null,
    }))
    .sort((a, b) => rank(a.name) - rank(b.name))
}
