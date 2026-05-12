'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [linkError, setLinkError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const setupRecovery = async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const search = typeof window !== 'undefined' ? window.location.search : ''
      const hashParams = new URLSearchParams(hash.replace('#', ''))
      const searchParams = new URLSearchParams(search)
      const params = hash ? hashParams : searchParams
      const type = params.get('type') || hashParams.get('type') || searchParams.get('type')
      const accessToken =
        params.get('access_token') || hashParams.get('access_token') || searchParams.get('access_token')
      const refreshToken =
        params.get('refresh_token') || hashParams.get('refresh_token') || searchParams.get('refresh_token')

      if (type === 'recovery' && accessToken && refreshToken) {
        await supabase.auth.signOut()
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname)
        }
        if (sessionError) {
          console.error('Failed to set recovery session:', sessionError)
          setLinkError('This reset link is invalid or has expired. Please request a new one.')
        } else {
          setHasRecoverySession(true)
        }
        setChecking(false)
        return
      }

      // Either user landed here without a token, or the link is malformed.
      // It's also possible Supabase already exchanged the token before this page mounted
      // (e.g. via PKCE) — check for an existing session.
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setHasRecoverySession(true)
      } else {
        setLinkError('This reset link is invalid or has expired. Please request a new one.')
      }
      setChecking(false)
    }

    setupRecovery()
  }, [supabase.auth])

  const handleSubmit = async (e: React.FormEvent) => {
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

      router.push('/')
    } catch (err) {
      console.error('Reset password error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAFAFA' }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#FAFAFA' }}>
      <div className="max-w-md w-full space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sign In
          </Link>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">DUST</h1>
          <p className="mt-2 text-gray-600">Studio</p>
        </div>

        <Card className="w-full max-w-md mx-auto">
          {linkError ? (
            <>
              <CardHeader>
                <CardTitle>Invalid reset link</CardTitle>
                <CardDescription>{linkError}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/forgot-password" className="block">
                  <Button
                    variant="outline"
                    className="w-full bg-white border border-black hover:bg-gray-50"
                  >
                    Request a new link
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Set a new password</CardTitle>
                <CardDescription>Enter and confirm your new password.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={loading || !hasRecoverySession}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={loading || !hasRecoverySession}
                      autoComplete="new-password"
                    />
                  </div>

                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full bg-white border border-black hover:bg-gray-50"
                    disabled={loading || !hasRecoverySession}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
