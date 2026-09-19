import { supabase } from '../supabase'

// Supabase's API returns at most 1,000 rows per request, so read in pages.
const PAGE = 1000

const WAGER_COLUMNS = [
  'wager_id', 'source', 'status', 'placed_at', 'placed_date_local',
  'sport', 'league', 'country', 'home_team', 'away_team', 'start_time',
  'market_type', 'period', 'variant', 'book', 'currency', 'account',
  'selection', 'line', 'bet_ref', 'is_freebet',
  'price_filled', 'stake', 'to_return',
  'ev_pct_bot', 'ev_pct_log', 'clv_pct', 'expected_profit', 'current_ev_pct',
  'result', 'profit', 'home_score', 'away_score',
].join(',')

const NUMERIC = ['line', 'price_filled', 'stake', 'to_return', 'ev_pct_bot', 'ev_pct_log',
  'clv_pct', 'expected_profit', 'current_ev_pct', 'profit']

export async function fetchWagers() {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('v_wager')
      .select(WAGER_COLUMNS)
      .order('placed_at', { ascending: true })
      .order('wager_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) break
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

// Starting balance per book, for the balance shown in the header.
// Missing columns (migration 003 not run yet) just mean no balance is shown.
export async function fetchBooks() {
  const { data, error } = await supabase.from('dim_book').select('name, starting_balance, balance_start')
  if (error) return {}
  return Object.fromEntries(data.map((b) => [b.name, {
    startingBalance: b.starting_balance == null ? null : Number(b.starting_balance),
    balanceStart: b.balance_start,
  }]))
}
