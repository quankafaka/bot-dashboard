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

export function odds(x) {
  return x == null ? '—' : x.toFixed(3).replace(/0$/, '')
}

const dt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})
export function when(iso) {
  return iso ? dt.format(new Date(iso)) : '—'
}

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
