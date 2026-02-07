'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AdminAcceptInvitePage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [hasInviteToken, setHasInviteToken] = useState(false)
  const [configError, setConfigError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkInviteFlow = async () => {
      // Supabase can pass tokens in hash (#) or query (?)
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const search = typeof window !== 'undefined' ? window.location.search : ''
      const hashParams = new URLSearchParams(hash.replace('#', ''))
      const searchParams = new URLSearchParams(search)
      const params = hash ? hashParams : searchParams // Prefer hash
      const type = params.get('type') || hashParams.get('type') || searchParams.get('type')
      const accessToken = params.get('access_token') || hashParams.get('access_token') || searchParams.get('access_token')
      const refreshToken = params.get('refresh_token') || hashParams.get('refresh_token') || searchParams.get('refresh_token')

      if ((type === 'invite' || type === 'recovery') && accessToken) {
        // Sign out any existing session first - prevents updating wrong user's password
        await supabase.auth.signOut()
        // Explicitly set session from invite tokens so we have the invited user's session
        if (refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          if (sessionError) {
            console.error('Failed to set invite session:', sessionError)
            setError('Invalid or expired invite link. Please request a new one.')
          }
        }
        // Clear tokens from URL (security - don't leave tokens in address bar)
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname)
        }
        setHasInviteToken(true)
        setChecking(false)
        return
      }

      if (accessToken && !type) {
        // Some Supabase versions may not include type
        await supabase.auth.signOut()
        if (refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        }
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname)
        }
        setHasInviteToken(true)
        setChecking(false)
        return
      }

      // No invite token - likely redirect URL not in Supabase allow list
      setConfigError(typeof window !== 'undefined' ? window.location.origin + '/admin/accept-invite' : '/admin/accept-invite')
      setChecking(false)
    }

    checkInviteFlow()
  }, [router, supabase.auth])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message || 'Failed to set password')
        return
      }

      // Password set - redirect to admin
      router.push('/admin')
    } catch (err) {
      console.error('Set password error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!hasInviteToken && !configError) {
    return null
  }

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">DUST</h1>
            <p className="mt-2 text-gray-600">Admin Portal</p>
          </div>
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Invite Link Setup Required</CardTitle>
              <CardDescription className="text-left space-y-3">
                <span className="block">Add this URL to Supabase:</span>
                <span className="block font-mono text-sm bg-gray-100 p-3 rounded break-all">{configError}</span>
                <span className="block">Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → Add the URL above.</span>
                <span className="block">Then request a new invite from an admin.</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => router.push('/admin/login')}>
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">DUST</h1>
          <p className="mt-2 text-gray-600">Admin Portal</p>
        </div>

        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Set Your Password</CardTitle>
            <CardDescription>Create a password to access the admin dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="ghost"
                className="w-full text-sm font-normal px-4 py-2 border border-black rounded bg-white hover:bg-gray-50"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                    Setting password...
                  </>
                ) : (
                  'Set Password & Continue'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
