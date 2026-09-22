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
// Added by migration 006. Until it has run they do not exist, and asking for
// them would fail the whole load -- so a missing-column error falls back to
// the base set and the alert column just shows dashes.
const ALERT_COLUMNS = ['pin_price_before', 'pin_price_after', 'pin_drop_pct', 'closing_price']

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
  let rows
  try {
    rows = await readAll([...BASE_COLUMNS, ...ALERT_COLUMNS])
  } catch (e) {
    const missingColumn = e?.code === '42703' || /does not exist/i.test(e?.message ?? '')
    if (!missingColumn) throw e                // 006 not run yet is the only excuse
    rows = await readAll(BASE_COLUMNS)
  }
  // Postgres numerics arrive as strings; convert once here.
  for (const r of rows) {
    for (const k of NUMERIC) r[k] = r[k] == null ? null : Number(r[k])
    r.placedMs = Date.parse(r.placed_at)
    r.startMs = r.start_time ? Date.parse(r.start_time) : null
  }
  return rows
}

export async function fetchAccounts() {
  const { data, error } = await supabase.from('dim_account').select('tag, description')
  if (error) throw error
  return Object.fromEntries(data.map((a) => [a.tag, a.description || a.tag]))
}

// The books this user may see, as granted in user_book_access (the database
// only returns those). Balance columns come from migration 003.
const BOOK_ORDER = ['BetInAsian', 'Mise-o-jeu']
const rank = (name) => (BOOK_ORDER.includes(name) ? BOOK_ORDER.indexOf(name) : BOOK_ORDER.length)

export async function fetchBooks() {
  const { data, error } = await supabase.from('dim_book').select('*')
  if (error) throw error
  return data
    .map((b) => ({
      name: b.name,
      currency: b.currency,
      startingBalance: b.starting_balance == null ? null : Number(b.starting_balance),
      balanceStart: b.balance_start ?? null,
    }))
    .sort((a, b) => rank(a.name) - rank(b.name))
}
