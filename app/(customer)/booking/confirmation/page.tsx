'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Calendar, User, CreditCard } from 'lucide-react'

interface BookingDetails {
  id: string
  customers: {
    name: string
    email: string
  }
  services: {
    name: string
    duration_minutes: number
  }
  booking_date: string
  booking_time: string
  price_charged: number
  payment_status: string
  status: string
}

function BookingConfirmationContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('id')
  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided')
      setLoading(false)
      return
    }

    const fetchBooking = async () => {
      try {
        // Use public confirmation API
        const response = await fetch(`/api/booking-confirmation/${bookingId}`)
        if (!response.ok) {
          throw new Error('Booking not found')
        }
        const data = await response.json()
        setBooking(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load booking')
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [bookingId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-4">
              <CreditCard className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-gray-600">
              {error || 'The booking you\'re looking for could not be found.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatDateTime = (date: string, time: string) => {
    // Create the actual date-time and format it properly with timezone
    const dateTime = new Date(`${date}T${time}`)
    
    // Format date part with timezone
    const dateOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Los_Angeles',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
    const formattedDate = dateTime.toLocaleDateString('en-US', dateOptions)
    
    // Format time to 12-hour format with AM/PM
    const timeOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    const formattedTime = dateTime.toLocaleTimeString('en-US', timeOptions)
    
    return `${formattedDate} at ${formattedTime}`
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Card className="shadow-lg">
          <CardHeader className="text-center bg-green-50 border-b border-green-200">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl text-green-800">Payment Successful!</CardTitle>
            <p className="text-green-600 mt-2">
              Thank you for your payment
            </p>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* Booking Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer Information
                </h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Name:</strong> {booking.customers.name}</p>
                  <p><strong>Email:</strong> {booking.customers.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Appointment Details
                </h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Service:</strong> {booking.services.name}</p>
                  <p><strong>Duration:</strong> {booking.services.duration_minutes} minutes</p>
                  <p><strong>Date & Time:</strong> {formatDateTime(booking.booking_date, booking.booking_time)}</p>
                  <p><strong>Total Paid:</strong> {formatPrice(booking.price_charged)}</p>
                </div>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-green-100 text-green-800 border-green-300">
                Payment: {booking.payment_status}
              </Badge>
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                Status: {booking.status}
              </Badge>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookingConfirmationContent />
    </Suspense>
  )
}
