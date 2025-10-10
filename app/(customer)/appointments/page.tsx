'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Booking, Service } from '@/types'
import { Button } from '@/components/ui/button'
import { formatBusinessDateTime } from '@/lib/timezone-utils-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Calendar, Clock, DollarSign, MapPin, User, RefreshCw, Eye, ArrowLeft, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
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

export default function ManageBookingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [bookingToReschedule, setBookingToReschedule] = useState<BookingWithDetails | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<BookingWithDetails | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/appointments')
      return
    }

    if (user) {
      fetchBookings()
    }
  }, [user, authLoading, router])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/customer/bookings')
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login?redirect=/appointments')
          return
        }
        if (response.status === 404) {
          setError('Customer account not found. Please contact support.')
          return
        }
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch bookings')
      }
      
      const data = await response.json()
      setBookings(data.bookings || [])
    } catch (error) {
      console.error('Error fetching bookings:', error)
      setError(error instanceof Error ? error.message : 'Failed to load your bookings')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    // Use timezone utilities for consistent date formatting
    return formatBusinessDateTime(dateString, '00:00:00', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    // Format time consistently using timezone utilities
    return formatBusinessDateTime('2025-01-01', timeString, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).split(' ').slice(-2).join(' ') // Extract just the time part
  }


  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(2)}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'no-show':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
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
    // Update the booking in local state
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

      // Remove the booking from local state completely
      setBookings(prev => 
        prev.filter(booking => booking.id !== bookingToCancel.id)
      )

      setShowCancelDialog(false)
      setBookingToCancel(null)
    } catch (error) {
      console.error('Error cancelling booking:', error)
      setError(error instanceof Error ? error.message : 'Failed to cancel booking')
    } finally {
      setCancelling(false)
    }
  }

  const upcomingBookings = bookings.filter(booking => 
    isUpcoming(booking.booking_date, booking.booking_time) && booking.status !== 'cancelled'
  )
  
  const pastBookings = bookings.filter(booking => 
    !isUpcoming(booking.booking_date, booking.booking_time)
  )

  if (authLoading || loading) {
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-red-600 mb-4">{error}</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Your Bookings</h1>
          <p className="text-gray-600">View and manage your appointments</p>
        </div>

        {/* Upcoming Bookings */}
        <div className="mb-8">
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

      {/* Cancel Confirmation Dialog */}
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
    </div>
  )
}
