import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { formatOdds } from './format'

// Decimal or American -- per PROFILE, stored in user_settings (migration 008),
// so it follows the login from the computer to the phone. The header switch
// saves to it; it can also be set for anyone from the SQL Editor.
//
// This browser keeps a copy so the first paint is already in the right format
// while the profile loads. Until migration 008 has run, that copy is all there
// is, and the switch still works -- just per browser.
const KEY = 'bot-ledger:odds-format'
const OddsContext = createContext({ format: 'decimal', setFormat: () => {} })

const valid = (f) => (f === 'american' ? 'american' : 'decimal')

function cached() {
  try {
    return valid(localStorage.getItem(KEY))
  } catch {
    return 'decimal'
  }
}

function cache(f) {
  try { localStorage.setItem(KEY, f) } catch { /* private mode: not remembered */ }
}

export function OddsProvider({ userId, children }) {
  const [format, setState] = useState(cached)

  // The profile's setting wins over whatever this browser remembered.
  useEffect(() => {
    if (!userId || !supabase) return
    let alive = true
    supabase.from('user_settings').select('odds_format').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!alive || error || !data) return      // no row yet, or no table yet: keep the cache
        const f = valid(data.odds_format)
        setState(f)
        cache(f)
      })
    return () => { alive = false }
  }, [userId])

  const setFormat = (f) => {
    const v = valid(f)
    setState(v)
    cache(v)
    if (userId && supabase) {
      supabase.from('user_settings')
        .upsert({ user_id: userId, odds_format: v }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) console.warn('Odds format not saved to the profile:', error.message)
        })
    }
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