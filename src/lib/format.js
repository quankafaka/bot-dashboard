const moneyFmt = new Map()

export function money(x, currency, { sign = false } = {}) {
  if (x == null || Number.isNaN(x)) return '—'
  const key = `${currency}${sign}`
  if (!moneyFmt.has(key)) {
    moneyFmt.set(key, new Intl.NumberFormat('en-CA', {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
      signDisplay: sign ? 'exceptZero' : 'auto',
    }))
  }
  return moneyFmt.get(key).format(x)
}

export function pct(x, { sign = true, digits = 1 } = {}) {
  if (x == null || Number.isNaN(x)) return '—'
  const s = x.toFixed(digits)
  return `${sign && x > 0 ? '+' : ''}${s}%`
}

// A Pinnacle limit: whole dollars, no currency code (Pinnacle quotes them in USD).
export function limitMoney(x) {
  return x == null || Number.isNaN(x) ? '—' : `$${Math.round(x).toLocaleString('en-CA')}`
}

export function odds(x) {
  return x == null ? '—' : x.toFixed(3).replace(/0$/, '')
}

// Decimal -> American. 2.50 is +150, 1.50 is -200; evens (2.00) is +100.
export function american(x) {
  if (x == null || !(x > 1)) return '—'
  return x >= 2 ? `+${Math.round((x - 1) * 100)}` : `-${Math.round(100 / (x - 1))}`
}

export function formatOdds(x, format = 'decimal') {
  return format === 'american' ? american(x) : odds(x)
}

const DEFAULT_ZONE = 'America/Toronto'
const dtFmt = new Map()
export function when(iso, timeZone = DEFAULT_ZONE) {
  if (!iso) return '—'
  if (!dtFmt.has(timeZone)) {
    dtFmt.set(timeZone, new Intl.DateTimeFormat('en-CA', {
      timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }))
  }
  return dtFmt.get(timeZone).format(new Date(iso))
}

// The clock each book's bet times are read on. BetInAsian is run from Costa
// Rica (UTC-6 all year, no daylight saving); every other book stays on
// Montreal time, like the rest of the site. Not labelled on the page: it is
// simply the time that book is read in.
const BOOK_ZONE = { BetInAsian: 'America/Costa_Rica' }

export const bookZone = (book) => BOOK_ZONE[book] ?? DEFAULT_ZONE

// The Account column only earns its place on a book with more than one
// account (Mise today). BetInAsian has one, so it is left off there -- the
// same rule the account filter buttons use.
export const multiAccount = (rows) => new Set(rows.map((r) => r.account)).size > 1

// When the bet was placed, on its book's clock.
export const betTime = (r) => when(r.placed_at, bookZone(r.book))

export function tone(x) {
  if (x == null || x === 0) return ''
  return x > 0 ? 'pos' : 'neg'
}

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const shortDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', weekday: 'short' })
const rangeFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', month: 'short', day: 'numeric' })

// 'YYYY-MM-DD' calendar dates, no time zone shifting.
export const dayLabel = (ymd) => dayFmt.format(new Date(`${ymd}T12:00:00Z`))
export const shortDay = (ymd) => shortDayFmt.format(new Date(`${ymd}T12:00:00Z`))
export const shortDate = (ymd) => rangeFmt.format(new Date(`${ymd}T12:00:00Z`))
