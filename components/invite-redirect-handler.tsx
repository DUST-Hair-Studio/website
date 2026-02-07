'use client'

import { useEffect } from 'react'

/**
 * When Supabase rejects the redirect URL (not in allow list), it sends users to
 * Site URL with tokens in the hash (e.g. https://www.dusthairstudio.com/#access_token=...).
 * This component redirects to /admin/accept-invite with the same hash so the
 * accept-invite page can set the session and show the password form.
 */
export function InviteRedirectHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const hash = window.location.hash
    if (!hash) return

    const pathname = window.location.pathname
    if (pathname === '/admin/accept-invite') return

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const type = params.get('type')
    const accessToken = params.get('access_token')

    const isInviteOrRecovery =
      (type === 'invite' || type === 'recovery') && !!accessToken
    if (!isInviteOrRecovery) return

    // Preserve hash so accept-invite can read tokens
    window.location.replace(`/admin/accept-invite${hash}`)
  }, [])

  return null
}
