'use client'

import { Navigation } from '@/components/navigation'
import { useAuth } from '@/lib/auth-context'
import { useState, useEffect } from 'react'
import { WaitlistRequestWithDetails } from '@/types'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Calendar, Clock, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function WaitlistPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [waitlistRequests, setWaitlistRequests] = useState<WaitlistRequestWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Handle authentication state changes
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Fetch waitlist requests
  useEffect(() => {
    const fetchWaitlist = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const response = await fetch('/api/customer/waitlist')
        const data = await response.json()

        if (response.ok) {
          setWaitlistRequests(data.waitlist || [])
        } else {
          console.error('Error fetching waitlist:', data.error)
          toast.error('Failed to load waitlist')
        }
      } catch (error) {
        console.error('Error fetching waitlist:', error)
        toast.error('Failed to load waitlist')
      } finally {
        setIsLoading(false)
      }
    }

    fetchWaitlist()
  }, [user])

  const handleCancelRequest = async (id: string) => {
    setDeletingId(id)

    try {
      const response = await fetch(`/api/waitlist/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Waitlist request cancelled')
        setWaitlistRequests(prev => prev.filter(req => req.id !== id))
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to cancel waitlist request')
      }
    } catch (error) {
      console.error('Error cancelling waitlist request:', error)
      toast.error('Failed to cancel waitlist request')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Waiting</Badge>
      case 'notified':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Notified</Badge>
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, show message
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Authentication Required</h2>
            <p className="text-red-600 mb-4">
              Please sign in to view your waitlist.
            </p>
            <Button onClick={() => router.push('/login')} className="bg-red-600 hover:bg-red-700">
              Sign In
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Waitlist</h1>
          <p className="text-gray-600">
            Track your appointment availability requests. We&apos;ll email you when a spot opens up!
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : waitlistRequests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Waitlist Requests</h3>
              <p className="text-gray-600 mb-6">
                You haven&apos;t joined any waitlists yet. When booking, you can join a waitlist to be notified if appointments become available.
              </p>
              <Button onClick={() => router.push('/book')}>
                Browse Services
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {waitlistRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{request.services.name}</CardTitle>
                        {getStatusBadge(request.status)}
                      </div>
                      <CardDescription>
                        {request.services.description}
                      </CardDescription>
                    </div>
                    {request.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(request.id)}
                        disabled={deletingId === request.id}
                      >
                        {deletingId === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Date Range */}
                    <div className="flex items-center text-sm">
                      <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-gray-700">
                        {formatDate(request.start_date)} - {formatDate(request.end_date)}
                      </span>
                    </div>

                    {/* Duration */}
                    <div className="flex items-center text-sm">
                      <Clock className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-gray-700">
                        {request.services.duration_minutes} minutes
                      </span>
                    </div>

                    {/* Status Information */}
                    {request.status === 'pending' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                        <p className="text-sm text-blue-900">
                          <strong>🔔 Watching for availability</strong>
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          We&apos;ll email you as soon as an appointment opens up in your selected date range.
                        </p>
                      </div>
                    )}

                    {request.status === 'notified' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                        <p className="text-sm text-green-900">
                          <strong>✅ Notification sent!</strong>
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          We sent you an email about an available appointment. 
                          {request.notified_at && ` Sent ${new Date(request.notified_at).toLocaleDateString()}`}
                        </p>
                        {request.expires_at && (
                          <p className="text-xs text-green-700 mt-1">
                            This notification expires {new Date(request.expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}

                    {request.status === 'expired' && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
                        <p className="text-sm text-gray-700">
                          <strong>This waitlist request has expired.</strong>
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          The date range or notification window has passed.
                        </p>
                      </div>
                    )}

                    {/* Created date */}
                    <div className="text-xs text-gray-500 pt-2 border-t">
                      Requested on {new Date(request.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Waitlist Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this waitlist request? You won&apos;t be notified if appointments become available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleCancelRequest(confirmDeleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

