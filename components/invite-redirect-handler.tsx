'use client'

import { useEffect } from 'react'

function hasInviteTokensInHash(): boolean {
  const hash = window.location.hash
  if (!hash) return false
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const type = params.get('type')
  const accessToken = params.get('access_token')
  return (type === 'invite' || type === 'recovery') && !!accessToken
}

function hasInviteTokensInQuery(): boolean {
  const params = new URLSearchParams(window.location.search)
  const type = params.get('type')
  const accessToken = params.get('access_token')
  return (type === 'invite' || type === 'recovery') && !!accessToken
}

/**
 * When Supabase redirects after invite verification it may send users to
 * Site URL (if redirect_to was rejected) with tokens in hash or query.
 * This component redirects to /admin/accept-invite preserving hash or query
 * so the accept-invite page can set the session and show the password form.
 */
export function InviteRedirectHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const pathname = window.location.pathname
    if (pathname === '/admin/accept-invite') return

    const hash = window.location.hash
    const search = window.location.search

    if (hash && hasInviteTokensInHash()) {
      window.location.replace(`/admin/accept-invite${hash}`)
      return
    }
    if (search && hasInviteTokensInQuery()) {
      window.location.replace(`/admin/accept-invite${search}`)
      return
    }
  }, [])

  return null
}
