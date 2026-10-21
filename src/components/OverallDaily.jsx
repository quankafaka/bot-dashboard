import { useMemo, useState } from 'react'
import { currencyGroups } from '../lib/metrics'
import { Week } from './Daily'
import { CurrencySwitch } from './Overall'

// Overall's Daily tab: a book's Daily week, for every book of one currency
// added together (CAD first, as on the Overview). Every bet counts, the
// bot's and the hand-logged ones alike, as on the rest of Overall.
export default function OverallDaily({ rows, books }) {
  const groups = useMemo(() => currencyGroups(books), [books])
  const [picked, setPicked] = useState(groups[0]?.currency)
  const group = groups.find((g) => g.currency === picked) ?? groups[0]
  const groupRows = useMemo(() => {
    const names = new Set(group?.books.map((b) => b.name))
    return rows.filter((r) => names.has(r.book))
  }, [rows, group])

  if (!group) return <p className="muted pad">No books to add up.</p>
  return (
    <Week rows={groupRows} currency={group.currency} toolbar={(nav) => (
      <section className="toolbar" aria-label="Filters">
        <CurrencySwitch groups={groups} value={group.currency} onChange={setPicked} />
        {nav}
        <span className="muted">{group.books.map((b) => b.name).join(' + ')}, in {group.currency}</span>
      </section>
    )} />
  )
}
