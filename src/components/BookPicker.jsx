import { useEffect, useId, useRef, useState } from 'react'
import { currencyGroups } from '../lib/metrics'

// The sportsbook switch in the header's top-left corner. Shut, it is a
// two-line button the height of the balance box: currency and open bets
// small on top, the book's name under it. Open, a menu: Overall first (for
// those who have it), then the books grouped by currency, CAD first, each
// with its open bets. Arrow keys move, Enter picks, Escape or a click
// elsewhere closes.
//   overall: { value, label, openCount } or null; books: dim_book rows;
//   openCounts: { [book name]: n }.
export default function BookPicker({ value, onChange, books, overall, openCounts }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef(null)
  const button = useRef(null)
  const listId = useId()

  // sub: what the small line says about the option -- its currency, or
  // 'All books' for Overall, which has no currency of its own.
  const options = [
    ...(overall ? [{ value: overall.value, label: overall.label, sub: 'All books', count: overall.openCount }] : []),
    ...currencyGroups(books).flatMap((g) => g.books.map((b, i) => ({
      value: b.name, label: b.name, sub: b.currency, ccy: b.currency, count: openCounts[b.name] ?? 0,
      heading: i === 0 ? g.currency : null,
    }))),
  ]
  const current = options.find((o) => o.value === value)
  const single = options.length < 2

  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('touchstart', away)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('touchstart', away)
    }
  }, [open])

  // Keep the highlighted option in view and focused while the menu is open.
  useEffect(() => {
    if (open) wrap.current?.querySelector(`[data-i="${active}"]`)?.focus()
  }, [open, active])

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const pick = (v) => {
    setOpen(false)
    button.current?.focus()
    if (v !== value) onChange(v)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className="picker" ref={wrap}>
      <button ref={button} type="button" className={`picker-btn ${open ? 'open' : ''}`} disabled={single}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-label={`Sportsbook: ${current?.label ?? 'none'}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); show() } }}>
        <span className="picker-text">
          <span className="picker-label">
            {current ? `${current.sub}${current.count ? ` · ${current.count} open` : ''}` : 'Sportsbook'}
          </span>
          <span className="picker-value">{current?.label ?? '—'}</span>
        </span>
        {!single && <span className="picker-caret" aria-hidden="true" />}
      </button>
      {open && (
        <ul id={listId} className="picker-menu" role="listbox" aria-label="Sportsbook" onKeyDown={onKey}>
          {options.map((o, i) => (
            <li key={o.value} role="presentation">
              {o.heading && <div className="picker-heading" aria-hidden="true">{o.heading}</div>}
              <div role="option" tabIndex={-1} data-i={i} aria-selected={o.value === value}
                className={`picker-opt ${o.value === value ? 'on' : ''} ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(o.value) } }}>
                <span className="picker-opt-name">{o.label}</span>
                <span className="picker-opt-meta">
                  {o.count > 0 && <span className="picker-count">{o.count} open</span>}
                  {o.ccy && <span className="ccy">{o.ccy}</span>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
