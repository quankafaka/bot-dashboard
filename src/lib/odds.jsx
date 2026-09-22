import { createContext, useContext, useState } from 'react'
import { formatOdds } from './format'

// Decimal or American, chosen in the header and remembered in this browser.
const KEY = 'bot-ledger:odds-format'
const OddsContext = createContext({ format: 'decimal', setFormat: () => {} })

function saved() {
  try {
    return localStorage.getItem(KEY) === 'american' ? 'american' : 'decimal'
  } catch {
    return 'decimal'
  }
}

export function OddsProvider({ children }) {
  const [format, setState] = useState(saved)
  const setFormat = (f) => {
    setState(f)
    try { localStorage.setItem(KEY, f) } catch { /* private mode: just not remembered */ }
  }
  return <OddsContext.Provider value={{ format, setFormat }}>{children}</OddsContext.Provider>
}

export function useOddsFormat() {
  return useContext(OddsContext)
}

// The formatter for the current choice: const fmt = useOdds(); fmt(2.5)
export function useOdds() {
  const { format } = useContext(OddsContext)
  return (x) => formatOdds(x, format)
}
