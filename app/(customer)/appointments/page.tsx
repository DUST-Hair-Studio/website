'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Booking } from '@/types'
import { WaitlistRequestWithDetails } from '@/types'
import { Button } from '@/components/ui/button'
import { formatBusinessDateTime } from '@/lib/timezone-utils-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Clock, DollarSign, RefreshCw, Eye, ArrowLeft, X, Bell, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import RescheduleModal from '@/components/admin/reschedule-modal'

interface BookingWithDetails extends Booking {
  services: {
    name: string
    description?: string
    duration_minutes: number
  } | null
  customers: {
    name: string
    email: string
    phone: string
  }
}

export default function MyAppointmentsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  
  // Bookings state
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookingsError, setBookingsError] = useState('')
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [bookingToReschedule, setBookingToReschedule] = useState<BookingWithDetails | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<BookingWithDetails | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Waitlist state
  const [waitlistRequests, setWaitlistRequests] = useState<WaitlistRequestWithDetails[]>([])
  const [waitlistLoading, setWaitlistLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/appointments')
      return
    }

    if (user) {
      fetchBookings()
      fetchWaitlist()
    }
  }, [user, authLoading, router])

  const fetchBookings = async () => {
    try {
      setBookingsLoading(true)
      setBookingsError('')
      const response = await fetch('/api/customer/bookings')
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login?redirect=/appointments')
          return
        }
        if (response.status === 404) {
          setBookingsError('Customer account not found. Please contact support.')
          return
        }
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch bookings')
      }
      
      const data = await response.json()
      setBookings(data.bookings || [])
    } catch (error) {
      console.error('Error fetching bookings:', error)
      setBookingsError(error instanceof Error ? error.message : 'Failed to load your bookings')
    } finally {
      setBookingsLoading(false)
    }
  }

  const fetchWaitlist = async () => {
    try {
      setWaitlistLoading(true)
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
      setWaitlistLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return formatBusinessDateTime(dateString, '00:00:00', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    return formatBusinessDateTime('2025-01-01', timeString, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).split(' ').slice(-2).join(' ')
  }

  const formatPrice = (priceInCents: number) => {
    return `$${Math.round(priceInCents / 100)}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
  }

  const getWaitlistStatusBadge = (status: string) => {
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

  const isUpcoming = (bookingDate: string, bookingTime: string) => {
    const now = new Date()
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`)
    return bookingDateTime > now
  }

  const canReschedule = (booking: BookingWithDetails) => {
    return isUpcoming(booking.booking_date, booking.booking_time) && 
           booking.status === 'confirmed'
  }

  const canCancel = (booking: BookingWithDetails) => {
    return isUpcoming(booking.booking_date, booking.booking_time) && 
           (booking.status === 'confirmed' || booking.status === 'pending')
  }

  const openRescheduleModal = (booking: BookingWithDetails) => {
    setBookingToReschedule(booking)
    setShowRescheduleModal(true)
  }

  const handleRescheduleSuccess = (updatedBooking: BookingWithDetails) => {
    setBookings(prev => 
      prev.map(booking => 
        booking.id === updatedBooking.id 
          ? { ...booking, booking_date: updatedBooking.booking_date, booking_time: updatedBooking.booking_time }
          : booking
      )
    )
    setShowRescheduleModal(false)
    setBookingToReschedule(null)
  }

  const openCancelDialog = (booking: BookingWithDetails) => {
    setBookingToCancel(booking)
    setShowCancelDialog(true)
  }

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return

    try {
      setCancelling(true)
      const response = await fetch(`/api/customer/bookings/${bookingToCancel.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel booking')
      }

      setBookings(prev => 
        prev.filter(booking => booking.id !== bookingToCancel.id)
      )

      setShowCancelDialog(false)
      setBookingToCancel(null)
    } catch (error) {
      console.error('Error cancelling booking:', error)
      setBookingsError(error instanceof Error ? error.message : 'Failed to cancel booking')
    } finally {
      setCancelling(false)
    }
  }

  const handleCancelWaitlistRequest = async (id: string) => {
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

  const formatWaitlistDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const upcomingBookings = bookings.filter(booking => 
    isUpcoming(booking.booking_date, booking.booking_time) && booking.status !== 'cancelled'
  )
  
  const pastBookings = bookings.filter(booking => 
    !isUpcoming(booking.booking_date, booking.booking_time)
  )

  if (authLoading || (bookingsLoading && waitlistLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    )
  }

  if (bookingsError) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-red-600 mb-4">{bookingsError}</p>
              <Button onClick={fetchBookings}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Appointments</h1>
          <p className="text-gray-600">Manage your bookings and waitlist requests</p>
        </div>

        <Tabs defaultValue="bookings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Bookings ({upcomingBookings.length + pastBookings.length})
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Waitlist ({waitlistRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-6">
            {/* Upcoming Bookings */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Upcoming Appointments ({upcomingBookings.length})
              </h2>
              
              {upcomingBookings.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-gray-500">No upcoming appointments</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {upcomingBookings.map((booking) => (
                    <Card key={booking.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                              <h3 className="font-semibold text-lg">
                                {booking.services?.name || 'Service'}
                              </h3>
                              <Badge className={getStatusColor(booking.status)}>
                                {booking.status}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-2" />
                                {formatDate(booking.booking_date)}
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                {formatTime(booking.booking_time)}
                              </div>
                              <div className="flex items-center">
                                <DollarSign className="w-4 h-4 mr-2" />
                                {formatPrice(booking.price_charged)}
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                {booking.duration_minutes} minutes
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            {canReschedule(booking) && (
                              <Button 
                                onClick={() => openRescheduleModal(booking)}
                                variant="outline"
                                size="sm"
                                className="flex items-center"
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reschedule
                              </Button>
                            )}
                            {canCancel(booking) && (
                              <Button 
                                onClick={() => openCancelDialog(booking)}
                                variant="outline"
                                size="sm"
                                className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Past Bookings */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Past Appointments ({pastBookings.length})
              </h2>
              
              {pastBookings.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-gray-500">No past appointments</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {pastBookings.map((booking) => (
                    <Card key={booking.id} className="opacity-75">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                              <h3 className="font-semibold text-lg">
                                {booking.services?.name || 'Service'}
                              </h3>
                              <Badge className={getStatusColor(booking.status)}>
                                {booking.status}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-2" />
                                {formatDate(booking.booking_date)}
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                {formatTime(booking.booking_time)}
                              </div>
                              <div className="flex items-center">
                                <DollarSign className="w-4 h-4 mr-2" />
                                {formatPrice(booking.price_charged)}
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                {booking.duration_minutes} minutes
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="flex items-center"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="waitlist" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                My Waitlist Requests ({waitlistRequests.length})
              </h2>
              <p className="text-gray-600 mb-6">
                Track your appointment availability requests. We&apos;ll email you when a spot opens up!
              </p>

              {waitlistLoading ? (
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
                              {getWaitlistStatusBadge(request.status)}
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
                              {formatWaitlistDate(request.start_date)} - {formatWaitlistDate(request.end_date)}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false)
          setBookingToReschedule(null)
        }}
        booking={bookingToReschedule}
        onRescheduleSuccess={handleRescheduleSuccess}
        apiEndpoint="/api/customer/bookings"
      />

      {/* Cancel Booking Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your appointment for{' '}
              <strong>{bookingToCancel?.services?.name}</strong> on{' '}
              <strong>{bookingToCancel ? formatDate(bookingToCancel.booking_date) : ''}</strong> at{' '}
              <strong>{bookingToCancel ? formatTime(bookingToCancel.booking_time) : ''}</strong>?
              <br /><br />
              This will remove the appointment from your schedule and cannot be undone. If you need to reschedule instead, please use the reschedule option.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelling ? 'Cancelling...' : 'Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Waitlist Request Confirmation Dialog */}
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
              onClick={() => confirmDeleteId && handleCancelWaitlistRequest(confirmDeleteId)}
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