import { useEffect, useState } from 'react'

// Phones get cards instead of tables. One breakpoint for the whole site, the
// same one the stylesheet uses for the bottom tab bar.
export const MOBILE_QUERY = '(max-width: 700px)'

export function useIsMobile() {
  const get = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  const [mobile, setMobile] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}
