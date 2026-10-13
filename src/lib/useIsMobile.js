import { useEffect, useState } from 'react'

// Phones get cards instead of tables. One breakpoint for the whole site, the
// same one the stylesheet uses for the bottom tab bar.
export const MOBILE_QUERY = '(max-width: 700px)'

// Pending and Graded show every column with no sideways scroll, and under this
// width that table gets too cramped to read -- so those two switch to the
// cards a little earlier than the rest of the site.
export const BET_TABLE_QUERY = '(max-width: 960px)'

export function useIsMobile(query = MOBILE_QUERY) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [mobile, setMobile] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return mobile
}