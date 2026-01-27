'use client'

import { useState, useEffect, useCallback } from 'react'
import { Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar as CalendarIcon, Clock, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import WaitlistForm from '@/components/customer/waitlist-form'

interface BookingWithDetails extends Booking {
  services: {
    name: string
    description?: string
    duration_minutes: number
    new_customer_price?: number
    existing_customer_price?: number
  } | null
  customers: {
    name: string
    email: string
    phone: string
    is_existing_customer?: boolean
  }
}

interface RescheduleModalProps {
  isOpen: boolean
  onClose: () => void
  booking: BookingWithDetails | null
  onRescheduleSuccess?: (updatedBooking: BookingWithDetails) => void
  apiEndpoint?: string // Allow custom API endpoint (default: admin endpoint)
}

export default function RescheduleModal({
  isOpen,
  onClose,
  booking,
  onRescheduleSuccess,
  apiEndpoint = '/api/admin/bookings'
}: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [businessHours, setBusinessHours] = useState<{day_of_week: number; is_open: boolean; open_time: string; close_time: string; timezone: string}[]>([])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && booking) {
      setSelectedDate(undefined)
      setSelectedTime('')
      setAvailableTimes([])
      setError('')
    }
  }, [isOpen, booking])

  // Fetch business hours
  useEffect(() => {
    const fetchBusinessHours = async () => {
      try {
        const response = await fetch('/api/admin/business-hours')
        if (response.ok) {
          const data = await response.json()
          setBusinessHours(data.businessHours || [])
        }
      } catch (error) {
        console.error('Error fetching business hours:', error)
      }
    }

    if (isOpen) {
      fetchBusinessHours()
    }
  }, [isOpen])

  // NOTE: Removed slow pre-checking of availability for each calendar day
  // Availability is now only fetched when a date is actually selected
  // This makes the modal load instantly

  // Business day and availability checking functions
  const isBusinessDay = (date: Date): boolean => {
    if (businessHours.length === 0) {
      return true
    }
    
    const dayOfWeek = date.getDay()
    const dayHours = businessHours.find(hours => hours.day_of_week === dayOfWeek)
    return !!(dayHours && dayHours.is_open)
  }

  const canReschedule = (booking: BookingWithDetails) => {
    const now = new Date()
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`)
    return bookingDateTime > now && booking.status === 'confirmed'
  }

  const handleDateSelect = async (date: Date | undefined) => {
    setSelectedDate(date)
    setSelectedTime('')
    setAvailableTimes([])
    
    if (date && booking) {
      await fetchAvailableTimes(date)
    }
  }

  const fetchAvailableTimes = async (date: Date): Promise<string[]> => {
    if (!booking) return []
    
    // Use booking.duration_minutes as fallback when service was deleted
    const duration = booking.services?.duration_minutes || booking.duration_minutes || 60

    try {
      setLoadingTimes(true)
      
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const url = `/api/admin/availability?startDate=${dateStr}&endDate=${dateStr}&serviceDuration=${duration}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Failed to fetch available times')
      }
      
      const data = await response.json()
      const times = data.availableSlots || []
      setAvailableTimes(times)
      return times
    } catch (error) {
      console.error('Error fetching available times:', error)
      setAvailableTimes([])
      return []
    } finally {
      setLoadingTimes(false)
    }
  }

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime || !booking) return

    setIsSubmitting(true)
    try {
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const response = await fetch(`${apiEndpoint}/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_date: dateStr,
          booking_time: selectedTime
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reschedule booking')
      }

      const updatedBooking = await response.json()
      
      toast.success('Booking rescheduled successfully!')
      
      // Call success callback if provided
      if (onRescheduleSuccess) {
        onRescheduleSuccess(updatedBooking.booking || updatedBooking)
      }
      
      onClose()
    } catch (error) {
      console.error('Error rescheduling booking:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reschedule booking')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  if (!booking) {
    return null
  }

  // Check if booking can be rescheduled
  if (!canReschedule(booking)) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cannot Reschedule</DialogTitle>
            <DialogDescription>
              This booking cannot be rescheduled
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-sm text-red-700">
                {booking.status !== 'confirmed' 
                  ? `Only confirmed bookings can be rescheduled. Current status: ${booking.status}`
                  : 'Past appointments cannot be rescheduled'
                }
              </p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-none w-[90vw] sm:w-[75vw] max-h-[90vh] overflow-y-auto pb-8">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>
            Choose a new date and time for {booking.customers.name}&apos;s appointment
          </DialogDescription>
        </DialogHeader>
        
        {/* Date and Time Selection - Same layout as booking flow */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Current Booking Details - Left column */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarIcon className="w-5 h-5 mr-2" />
                Current Appointment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{booking.services?.name}</h3>
                <p className="text-gray-600">{booking.services?.description}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center">
                  <CalendarIcon className="w-4 h-4 mr-2 text-gray-500" />
                  <span>{formatDate(booking.booking_date)}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-gray-500" />
                  <span>{formatTime(booking.booking_time)}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-gray-500" />
                  <span>{booking.services?.duration_minutes || booking.duration_minutes} minutes</span>
                </div>
              </div>
              
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {booking.status}
              </Badge>
            </CardContent>
          </Card>

          {/* Date Selection - Middle column */}
          <Card>
            <CardHeader>
              <CardTitle>Select Date</CardTitle>
              <CardDescription>Choose your preferred date</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full pb-12 px-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const isPast = date < today
                    const isBusinessDayResult = isBusinessDay(date)
                    return isPast || !isBusinessDayResult
                  }}
                  className="border-t border-b w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Time Selection - Right column */}
          <Card>
            <CardHeader>
              <CardTitle>Select Time</CardTitle>
              <CardDescription>
                Available times for {selectedDate?.toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                <div className="grid grid-cols-1 gap-2">
                  {loadingTimes ? (
                    <p className="text-gray-500 text-center py-4">Loading available times...</p>
                  ) : availableTimes.length > 0 ? (
                    availableTimes.map((time, index) => {
                      const isSelected = selectedTime === time
                      return (
                        <Button
                          key={`${time}-${index}`}
                          variant="outline"
                          onClick={() => setSelectedTime(time)}
                          className={`w-full ${isSelected ? 'bg-black text-white border-black hover:bg-black hover:text-white' : 'hover:bg-gray-50'}`}
                        >
                          {time}
                        </Button>
                      )
                    })
                  ) : (
                    <div>
                      <p className="text-gray-500 text-center py-4">No available times for this date</p>
                      {/* Show waitlist option when no times available */}
                      {booking?.services && (
                        <WaitlistForm
                          serviceId={booking.service_id}
                          serviceName={booking.services.name}
                          compact={true}
                          onSuccess={() => {
                            toast.success('You\'ll be notified if a spot opens up!')
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">Please select a date first</p>
              )}
              
              {/* Also show waitlist option at bottom even when times are available */}
              {selectedDate && availableTimes.length > 0 && booking?.services && (
                <WaitlistForm
                  serviceId={booking.service_id}
                  serviceName={booking.services.name}
                  compact={true}
                  onSuccess={() => {
                    toast.success('You\'ll be notified if a spot opens up!')
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-7xl mx-auto mt-6">
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button - Same as booking flow */}
        {selectedDate && selectedTime && (
          <div className="max-w-7xl mx-auto mt-8">
            <Button 
              onClick={handleReschedule}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Rescheduling...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reschedule Appointment
                </>
              )}
            </Button>
          </div>
        )}

        {/* Cancel Button */}
        <div className="max-w-7xl mx-auto mt-4">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
