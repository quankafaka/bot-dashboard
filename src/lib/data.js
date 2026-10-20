import { supabase } from '../supabase'

// Supabase's API returns at most 1,000 rows per request, so read in pages.
const PAGE = 1000

// The side views below can be read for a few bets only (ids), for the bets
// the new-bet check just brought in; without ids they read every bet.
const only = (q, ids) => (ids ? q.in('wager_id', ids) : q)

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

async function readAll(columns, since) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('v_wager').select(columns.join(','))
    if (since) q = q.gte('placed_at', since)
    const { data, error } = await q
      .order('placed_at', { ascending: true })
      .order('wager_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

// since: only the bets placed at or after that time (the new-bet check in
// App), instead of the whole history.
export async function fetchWagers({ since } = {}) {
  const attempts = [
    [...BASE_COLUMNS, ...ALERT_COLUMNS, ...ALERT_SELECTION],
    [...BASE_COLUMNS, ...ALERT_COLUMNS],
    BASE_COLUMNS,
  ]
  let rows
  for (const columns of attempts) {
    try {
      rows = await readAll(columns, since)
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
    if (r.account === SHARED_BET99) r.account = SHARED_BET99_OWNER
  }
  return rows
}

// Which system took each bet -- the steam chaser or the NFL / CFB models --
// from v_wager_strategy (migration 008), joined to v_wager rows on wager_id.
// Returns null, not an error, until that migration has run: the rest of the
// dashboard does not depend on it, so it must not fail the whole load.
export async function fetchStrategies(ids) {
  const labels = new Map()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await only(supabase.from('v_wager_strategy').select('wager_id,strategy'), ids)
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
export async function fetchLimits(ids) {
  const limits = new Map()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await only(supabase.from('v_wager_limit').select('wager_id,pinnacle_limit,limit_source,limit_tier'), ids)
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
export async function fetchModelPrices(ids) {
  const prices = new Map()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await only(supabase.from('v_wager_model').select('wager_id,model_price,model_ev_pct'), ids)
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

// How the bot made the fair price behind each bet's EV, from v_wager_devig
// (migration 012): the de-vig method ('logit', 'power', 'shin', or 'pdropper'
// when pdropper's own EV was used), Pinnacle's price on the line before the
// de-vig and the fair price after it. Bot bets from 2026-10-13 on only.
// Returns null, not an error, until the migration has run.
export async function fetchDevig(ids) {
  const devig = new Map()
  const n = (v) => (v == null ? null : Number(v))
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await only(supabase.from('v_wager_devig').select('wager_id,devig_method,devig_price_before,devig_price_after,devig_market_prices,devig_pdrop_nvp,devig_hold_pct'), ids)
      .order('wager_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      const missing = ['42P01', 'PGRST205'].includes(error.code)
        || /does not exist|could not find/i.test(error.message ?? '')
      if (missing) return null
      throw error
    }
    for (const r of data) {
      devig.set(r.wager_id, {
        method: r.devig_method,
        before: n(r.devig_price_before),
        after: n(r.devig_price_after),
        market: r.devig_market_prices,
        pdropNvp: n(r.devig_pdrop_nvp),
        hold: n(r.devig_hold_pct),
      })
    }
    if (data.length < PAGE) break
  }
  return devig
}

// The pages beyond the per-book ones this user may open, as granted in
// user_page_access (migration 013; the database only returns the user's own
// rows). Today only 'overall'. An empty set, not an error, until the
// migration has run: nobody sees those pages, the rest of the site loads.
export async function fetchPageAccess() {
  const { data, error } = await supabase.from('user_page_access').select('page')
  if (error) {
    const missing = ['42P01', 'PGRST205'].includes(error.code)
      || /does not exist|could not find/i.test(error.message ?? '')
    if (missing) return new Set()
    throw error
  }
  return new Set(data.map((r) => r.page))
}

// Every Bet99 bet under the shared 'bet99' account is Alex's: the bot's bets
// from before the two-device split (2026-10-14) were placed from Alex's
// computer, and Bet99 bets logged by hand are his too. They are folded into
// Alex's account here, on the page, rather than in the database: the BIA
// laptop's sync writes 'bet99' on the rows it grades and on hand-logged ones,
// so a database fix would be undone by its next run.
const SHARED_BET99 = 'bet99'
const SHARED_BET99_OWNER = 'bet99#alex'

// What each account is called on the page: its description, else a name
// made from the tag. Bet99 runs on two devices (2026-10-14) and the bot files
// each device's bets under its own tag, 'bet99#jack', the way Mise's are split
// into 'mise#1', 'mise#2'; the bot writes the device's name as the
// description, so the fallback only shows until it has. ('bet99' itself never
// reaches the page: see SHARED_BET99 above.) The LeoVegas bot files its bets
// the same way, 'leovegas#jack' (2026-10-20).
export function accountLabel(tag, description) {
  if (description) return description
  const device = /^(?:bet99|leovegas)#(.+)$/i.exec(tag ?? '')
  if (device) return device[1].charAt(0).toUpperCase() + device[1].slice(1)
  return tag
}

export async function fetchAccounts() {
  const { data, error } = await supabase.from('dim_account').select('tag, description')
  if (error) throw error
  const names = Object.fromEntries(data.map((a) => [a.tag, accountLabel(a.tag, a.description)]))
  // Named even before Alex's computer has pushed a bet under its own tag.
  names[SHARED_BET99_OWNER] ??= accountLabel(SHARED_BET99_OWNER, null)
  return names
}

// The accounts with a starting balance of their own (migration 014), for
// books shared by more than one person. Empty, not an error, until the
// migration has run: those books then show no balance.
export async function fetchAccountBalances() {
  const { data, error } = await supabase.from('dim_account')
    .select('tag, starting_balance, balance_start').not('starting_balance', 'is', null)
  if (error) {
    if (error.code === '42703' || /does not exist/i.test(error.message ?? '')) return []
    throw error
  }
  return data.map((a) => ({
    tag: a.tag,
    startingBalance: Number(a.starting_balance),
    balanceStart: a.balance_start ?? null,
  }))
}

// The books this user may see, as granted in user_book_access (the database
// only returns those, so that grant is the one place access is decided).
// Balance columns come from migration 003.
// A book missing here still shows, after these.
const BOOK_ORDER = ['BetInAsian', 'Mise-o-jeu', 'Bet99', 'OLG', 'LeoVegas']
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
