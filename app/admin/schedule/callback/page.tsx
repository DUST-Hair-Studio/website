"use client"

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

function GoogleCalendarCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const error = searchParams.get('error')

        if (error) {
          setStatus('error')
          setMessage(`Authorization failed: ${error}`)
          toast.error(`Authorization failed: ${error}`)
          return
        }

        if (!code) {
          setStatus('error')
          setMessage('No authorization code received')
          toast.error('No authorization code received')
          return
        }

        // Send the authorization code to our API
        const response = await fetch('/api/admin/google-calendar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to connect Google Calendar')
        }

        setStatus('success')
        setMessage('Google Calendar connected successfully!')
        toast.success('Google Calendar connected successfully!')

        // Redirect back to schedule page after a short delay
        setTimeout(() => {
          router.push('/admin/schedule')
        }, 2000)

      } catch (error) {
        console.error('Google Calendar callback error:', error)
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
        toast.error(error instanceof Error ? error.message : 'An unexpected error occurred')
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting Google Calendar...
              </h2>
              <p className="text-gray-600">
                Please wait while we set up your Google Calendar integration.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Success!
              </h2>
              <p className="text-gray-600 mb-4">
                {message}
              </p>
              <p className="text-sm text-gray-500">
                Redirecting you back to the schedule page...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Failed
              </h2>
              <p className="text-gray-600 mb-4">
                {message}
              </p>
              <button
                onClick={() => router.push('/admin/schedule')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Back to Schedule
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GoogleCalendarCallback() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GoogleCalendarCallbackContent />
    </Suspense>
  )
}
