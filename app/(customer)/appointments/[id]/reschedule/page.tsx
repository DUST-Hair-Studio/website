'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { ArrowLeft, Calendar as CalendarIcon, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'

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

export default function ReschedulePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const bookingId = params.id as string

  const [booking, setBooking] = useState<BookingWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [businessHours, setBusinessHours] = useState<{day_of_week: number; is_open: boolean; open_time: string; close_time: string; timezone: string}[]>([])
  
  // State to track dates with no availability (same as booking flow)
  const [datesWithNoAvailability, setDatesWithNoAvailability] = useState<Set<string>>(new Set())
  
  // Cache for availability checks to avoid duplicate API calls (same as booking flow)
  const [availabilityCache, setAvailabilityCache] = useState<Map<string, boolean>>(new Map())

  const fetchBooking = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customer/bookings/${bookingId}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login?redirect=/appointments')
          return
        }
        if (response.status === 404) {
          setError('Booking not found')
          return
        }
        throw new Error('Failed to fetch booking')
      }
      
      const data = await response.json()
      setBooking(data.booking)
      
      // Check if booking can be rescheduled
      if (data.booking && !canReschedule(data.booking)) {
        setError('This booking cannot be rescheduled')
        return
      }
    } catch (error) {
      console.error('Error fetching booking:', error)
      setError('Failed to load booking details')
    } finally {
      setLoading(false)
    }
  }, [bookingId, router])

  const canReschedule = (booking: BookingWithDetails) => {
    const now = new Date()
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`)
    return bookingDateTime > now && booking.status === 'confirmed'
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/appointments')
      return
    }

    if (user && bookingId) {
      fetchBooking()
    }
  }, [user, authLoading, bookingId, router, fetchBooking])

  // Fetch business hours (same as booking flow)
  useEffect(() => {
    const fetchBusinessHours = async () => {
      try {
        const response = await fetch('/api/admin/business-hours')
        if (response.ok) {
          const data = await response.json()
          console.log('🔍 Reschedule - Business hours loaded:', data.businessHours)
          setBusinessHours(data.businessHours || [])
        }
      } catch (error) {
        console.error('❌ Reschedule - Error fetching business hours:', error)
      }
    }

    fetchBusinessHours()
  }, [])

  // Efficient availability check for visible calendar days (same as booking flow)
  const checkAvailabilityForVisibleDays = useCallback(async () => {
    if (!booking?.services || businessHours.length === 0) return
    
    console.log('🔍 Reschedule - Checking availability for visible calendar days...')
    setLoadingCalendar(true)
    
    try {
      const today = new Date()
      
      // Check current month first (most likely to be visible)
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      
      // Get business days for current month first
      const currentMonthBusinessDays: string[] = []
      const currentDate = new Date(currentMonth)
      
      const isBusinessDayForCheck = (date: Date): boolean => {
        if (businessHours.length === 0) return true
        const dayOfWeek = date.getDay()
        const dayHours = businessHours.find(hours => hours.day_of_week === dayOfWeek)
        return !!(dayHours && dayHours.is_open)
      }
      
      while (currentDate < nextMonth) {
        if (isBusinessDayForCheck(currentDate)) {
          const year = currentDate.getFullYear()
          const month = String(currentDate.getMonth() + 1).padStart(2, '0')
          const day = String(currentDate.getDate()).padStart(2, '0')
          currentMonthBusinessDays.push(`${year}-${month}-${day}`)
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      console.log('🔍 Reschedule - Current month business days:', currentMonthBusinessDays.length)
      
      // Check availability for current month business days
      for (const dateStr of currentMonthBusinessDays) {
        // Skip if already cached
        if (availabilityCache.has(dateStr)) continue
        
        try {
          const url = `/api/admin/availability?startDate=${dateStr}&endDate=${dateStr}&serviceDuration=${booking.services.duration_minutes}`
          const response = await fetch(url)
          
          if (response.ok) {
            const data = await response.json()
            const hasAvailability = data.availableSlots && data.availableSlots.length > 0
            
            // Update cache
            setAvailabilityCache(prev => new Map(prev.set(dateStr, hasAvailability)))
            
            // Update dates with no availability
            if (!hasAvailability) {
              setDatesWithNoAvailability(prev => new Set(prev).add(dateStr))
              console.log(`🔍 Reschedule - No availability for ${dateStr}`)
            }
          }
        } catch (error) {
          console.error(`❌ Reschedule - Error checking availability for ${dateStr}:`, error)
        }
      }
    } catch (error) {
      console.error('❌ Reschedule - Error in checkAvailabilityForVisibleDays:', error)
    } finally {
      setLoadingCalendar(false)
    }
  }, [booking, businessHours, availabilityCache])

  // Check availability for visible calendar days when booking and business hours are loaded (same as booking flow)
  useEffect(() => {
    if (booking && businessHours.length > 0) {
      console.log('🔍 Reschedule - Running availability check for visible days')
      checkAvailabilityForVisibleDays()
    }
  }, [booking, businessHours, checkAvailabilityForVisibleDays])

  // Business day and availability checking functions (same as booking flow)
  const isBusinessDay = (date: Date): boolean => {
    // If business hours haven't loaded yet, allow all dates temporarily
    if (businessHours.length === 0) {
      console.log('🔍 Reschedule - Business hours not loaded yet, allowing date:', date.toDateString())
      return true
    }
    
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayHours = businessHours.find(hours => hours.day_of_week === dayOfWeek)
    const isOpen = dayHours && dayHours.is_open
    
    console.log(`🔍 Reschedule - Date: ${date.toDateString()}, Day: ${dayOfWeek}, DayHours:`, dayHours, `IsOpen: ${isOpen}`)
    return !!isOpen
  }

  const hasNoAvailability = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const hasNoAvail = datesWithNoAvailability.has(dateStr)
    console.log(`🔍 Reschedule - hasNoAvailability(${dateStr}): ${hasNoAvail}`)
    return hasNoAvail
  }

  const handleDateSelect = async (date: Date | undefined) => {
    setSelectedDate(date)
    setSelectedTime('')
    setAvailableTimes([])
    
    if (date && booking?.services) {
      await fetchAvailableTimes(date)
    }
  }

  const fetchAvailableTimes = async (date: Date): Promise<string[]> => {
    if (!booking?.services) return []

    try {
      setLoadingTimes(true)
      
      // Format date as YYYY-MM-DD (same as booking flow)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      // Use the exact same API endpoint and parameters as the booking flow
      const url = `/api/admin/availability?startDate=${dateStr}&endDate=${dateStr}&serviceDuration=${booking.services.duration_minutes}`
      console.log('🔍 Reschedule - Fetching availability from:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        console.error('❌ Reschedule - Availability API error:', response.status, response.statusText)
        throw new Error('Failed to fetch available times')
      }
      
      const data = await response.json()
      const times = data.availableSlots || []
      console.log('🔍 Reschedule - Found available times:', times)
      setAvailableTimes(times)
      return times
    } catch (error) {
      console.error('❌ Reschedule - Error fetching available times:', error)
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
      // Format date as YYYY-MM-DD
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const response = await fetch(`/api/customer/bookings/${bookingId}`, {
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

      toast.success('Booking rescheduled successfully!')
      router.push('/appointments')
    } catch (error) {
      console.error('Error rescheduling booking:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reschedule booking')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    // Parse date string without timezone conversion to avoid day shift
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
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

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => router.push('/appointments')}>
                Back to Appointments
              </Button>
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
            onClick={() => router.push('/appointments')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Appointments
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reschedule Appointment</h1>
          <p className="text-gray-600">Choose a new date and time for your appointment</p>
        </div>

        {/* Date and Time Selection - Same narrow layout as booking flow */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
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
                  <span>{booking.services?.duration_minutes} minutes</span>
                </div>
              </div>
              
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {booking.status}
              </Badge>
            </CardContent>
          </Card>
          {/* Date Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Date</CardTitle>
              <CardDescription>Choose your preferred date</CardDescription>
            </CardHeader>
            <CardContent className="p-0 relative">
              <div className="w-full pb-8 px-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    const isPast = date < new Date()
                    const isBusinessDayResult = isBusinessDay(date)
                    const hasNoAvail = hasNoAvailability(date)
                    // Disable past dates, non-business days, AND dates with no availability
                    const isDisabled = isPast || !isBusinessDayResult || hasNoAvail
                    
                    console.log(`🔍 Reschedule - Calendar disabled check for ${date.toDateString()}:`, {
                      isPast,
                      isBusinessDayResult,
                      hasNoAvail,
                      isDisabled
                    })
                    
                    return isDisabled
                  }}
                  className="border-t border-b w-full"
                />
              </div>
              {loadingCalendar && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                  <div className="flex items-center space-x-2">
                    <svg 
                      className="animate-spin h-5 w-5 text-gray-900" 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        stroke="currentColor" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M8 2v4l-2 2 2 2v4M16 2v4l2 2-2 2v4M8 12h8"
                      />
                    </svg>
                    <span className="text-sm text-gray-600">Loading availability...</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Time</CardTitle>
              <CardDescription>Available times for {selectedDate?.toLocaleDateString()}</CardDescription>
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
                    <p className="text-gray-500 text-center py-4">No available times for this date</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">Please select a date first</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        {selectedDate && selectedTime && (
          <div className="max-w-4xl mx-auto mt-8">
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
      </div>
    </div>
  )
}
