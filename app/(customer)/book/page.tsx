'use client'

import { Navigation } from '@/components/navigation'
import { useAuth } from '@/lib/auth-context'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { Service } from '@/types'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import WaitlistForm from '@/components/customer/waitlist-form'
import { toast } from 'sonner'

function BookPageContent() {
  const { user, loading } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const serviceId = searchParams.get('serviceId')
  const waitlistId = searchParams.get('waitlist_id')
  
  // Debug logging for waitlist tracking
  useEffect(() => {
    if (waitlistId) {
      console.log('🎯 [WAITLIST TRACKING] Waitlist ID detected in URL:', waitlistId)
    }
  }, [waitlistId])
  
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [customerInfo, setCustomerInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  })
  const [customer, setCustomer] = useState<{ is_existing_customer: boolean } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [businessHours, setBusinessHours] = useState<{day_of_week: number; is_open: boolean; open_time: string; close_time: string; timezone: string}[]>([])
  const [waitlistEnabled, setWaitlistEnabled] = useState(true)
  
  const [step, setStep] = useState(1) // 1: Service, 2: Date/Time, 3: Details, 4: Confirmation

  // State to track dates with no availability
  const [datesWithNoAvailability, setDatesWithNoAvailability] = useState<Set<string>>(new Set())
  
  // Cache for availability checks to avoid duplicate API calls
  const [availabilityCache, setAvailabilityCache] = useState<Map<string, boolean>>(new Map())

  // Handle authentication state changes - MUST be before other useEffects
  useEffect(() => {
    if (!loading && !user) {
      // User is not authenticated, redirect to login
      router.push('/login')
    }
  }, [user, loading, router])

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('/api/services')
        const data = await response.json()
        setServices(data.services || [])
        
        // If serviceId is provided, find and select that service
        if (serviceId) {
          const service = data.services.find((s: Service) => s.id === serviceId)
          if (service) {
            setSelectedService(service)
            setStep(2) // Skip to date/time selection
          }
        }
      } catch (error) {
        console.error('Error fetching services:', error)
      }
    }

    fetchServices()
  }, [serviceId])

  // Fetch waitlist setting
  useEffect(() => {
    const fetchWaitlistSetting = async () => {
      try {
        const response = await fetch('/api/admin/settings')
        if (response.ok) {
          const data = await response.json()
          setWaitlistEnabled(data.waitlist?.enabled !== false) // Default to true if not set
        }
      } catch (error) {
        console.error('Error fetching waitlist setting:', error)
        // Default to enabled if there's an error
        setWaitlistEnabled(true)
      }
    }

    fetchWaitlistSetting()
  }, [])

  // Fetch customer info if logged in
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!user) return

      try {
        const response = await fetch('/api/customer/me')
        const data = await response.json()
        
        if (data.customer) {
          setCustomerInfo({
            firstName: data.customer.first_name || '',
            lastName: data.customer.last_name || '',
            email: data.customer.email || '',
            phone: data.customer.phone || ''
          })
          setCustomer(data.customer)
        }
      } catch (error) {
        console.error('Error fetching customer data:', error)
      }
    }

    fetchCustomer()
  }, [user])

  // Fetch business hours
  useEffect(() => {
    const fetchBusinessHours = async () => {
      try {
        const response = await fetch('/api/admin/business-hours')
        if (response.ok) {
          const data = await response.json()
          console.log('Business hours loaded:', data.businessHours)
          console.log('Open days:', data.businessHours?.filter((h: { is_open: boolean }) => h.is_open))
          setBusinessHours(data.businessHours || [])
        }
      } catch (error) {
        console.error('Error fetching business hours:', error)
      }
    }

    fetchBusinessHours()
  }, [])

  const isBusinessDay = useCallback((date: Date): boolean => {
    // If business hours haven't loaded yet, allow all dates temporarily
    if (businessHours.length === 0) {
      console.log('Business hours not loaded yet, allowing date:', date.toDateString())
      return true
    }
    
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayHours = businessHours.find(hours => hours.day_of_week === dayOfWeek)
    const isOpen = dayHours && dayHours.is_open
    
    console.log(`Date: ${date.toDateString()}, Day: ${dayOfWeek}, DayHours:`, dayHours, `IsOpen: ${isOpen}`)
    return !!isOpen
  }, [businessHours])

  const hasNoAvailability = useCallback((date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const hasNoAvail = datesWithNoAvailability.has(dateStr)
    console.log(`🔍 hasNoAvailability(${dateStr}): ${hasNoAvail}`)
    if (dateStr === '2025-10-10') {
      console.log(`🎯 OCTOBER 10TH CHECK: ${dateStr}, hasNoAvail: ${hasNoAvail}`)
      console.log(`🎯 OCTOBER 10TH datesWithNoAvailability set:`, Array.from(datesWithNoAvailability))
    }
    return hasNoAvail
  }, [datesWithNoAvailability])

  // Efficient availability check for visible calendar days (prioritized)
  const checkAvailabilityForVisibleDays = useCallback(async () => {
    if (!selectedService || businessHours.length === 0) return
    
    console.log('🔍 Checking availability for visible calendar days (prioritized)...')
    console.log('🔍 Service being used in checkAvailabilityForVisibleDays:', {
      name: selectedService.name,
      duration: selectedService.duration_minutes
    })
    setLoadingCalendar(true)
    
    try {
      const today = new Date()
      
      // Check current month first (most likely to be visible)
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      
      // Get business days for current month first
      const currentMonthBusinessDays: string[] = []
      const currentDate = new Date(currentMonth)
      
      while (currentDate < nextMonth) {
        if (isBusinessDay(currentDate)) {
          currentMonthBusinessDays.push(currentDate.toISOString().split('T')[0])
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      // Check which dates we haven't cached yet (prioritize current month)
      const datesToCheck = currentMonthBusinessDays.filter(dateStr => !availabilityCache.has(dateStr))
      console.log(`📅 Checking ${datesToCheck.length} dates from current month (${currentMonthBusinessDays.length} total business days in current month)`)
      
      if (datesToCheck.length === 0) {
        console.log('📅 Current month already cached, checking next month...')
        // If current month is cached, check next month
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)
        const nextMonthBusinessDays: string[] = []
        const nextMonthDate = new Date(nextMonth)
        
        while (nextMonthDate <= nextMonthEnd) {
          if (isBusinessDay(nextMonthDate)) {
            nextMonthBusinessDays.push(nextMonthDate.toISOString().split('T')[0])
          }
          nextMonthDate.setDate(nextMonthDate.getDate() + 1)
        }
        
        const nextMonthDatesToCheck = nextMonthBusinessDays.filter(dateStr => !availabilityCache.has(dateStr))
        if (nextMonthDatesToCheck.length === 0) {
          console.log('📅 Next month also cached, using cached results')
          return
        }
        
        console.log(`📅 Checking ${nextMonthDatesToCheck.length} dates from next month`)
        datesToCheck.push(...nextMonthDatesToCheck)
      }
      
      // Make parallel API calls only for dates we haven't checked
      const promises = datesToCheck.map(async (dateStr) => {
        try {
          const dayUrl = `/api/admin/availability?startDate=${dateStr}&endDate=${dateStr}&serviceDuration=${selectedService.duration_minutes}`
          const dayResponse = await fetch(dayUrl)
          
          if (dayResponse.ok) {
            const dayData = await dayResponse.json() as { availableSlots: string[] }
            const daySlots = dayData.availableSlots || []
            const hasAvailability = daySlots.length > 0
            
            // Cache the result
            setAvailabilityCache(prev => new Map(prev).set(dateStr, hasAvailability))
            
            if (dateStr === '2025-10-10') {
              console.log(`🎯 OCTOBER 10TH API RESPONSE:`, { dayData, daySlots, length: daySlots.length, hasAvailability })
            }
            
            if (!hasAvailability) {
              console.log(`❌ ${dateStr} has no availability - will be disabled`)
              if (dateStr === '2025-10-10') {
                console.log(`🎯 OCTOBER 10TH: No availability found, will be disabled`)
              }
              return dateStr
            } else {
              console.log(`✅ ${dateStr} has ${daySlots.length} available slots - will be enabled`)
              if (dateStr === '2025-10-10') {
                console.log(`🎯 OCTOBER 10TH: Has ${daySlots.length} available slots, will be enabled`)
              }
              return null
            }
          } else {
            console.error(`❌ Failed to fetch availability for ${dateStr}: ${dayResponse.status}`)
            if (dateStr === '2025-10-10') {
              console.log(`🎯 OCTOBER 10TH: API request failed with status ${dayResponse.status}`)
            }
          }
        } catch (error) {
          console.error(`Error checking ${dateStr}:`, error)
          if (dateStr === '2025-10-10') {
            console.log(`🎯 OCTOBER 10TH: Error occurred:`, error)
          }
        }
        return null
      })
      
      // Wait for all promises to resolve
      const results = await Promise.all(promises)
      const newUnavailableDates = results.filter(date => date !== null) as string[]
      
      // Update the unavailable dates set with new findings
      setDatesWithNoAvailability(prev => {
        const updated = new Set(prev)
        newUnavailableDates.forEach(date => updated.add(date))
        return updated
      })
      
      console.log('📅 New dates to disable (no availability):', newUnavailableDates)
      
      // Special check for October 10th
      if (newUnavailableDates.includes('2025-10-10')) {
        console.log('🎯 CONFIRMED: October 10th is in the unavailable dates list')
      } else {
        console.log('🎯 WARNING: October 10th is NOT in the unavailable dates list')
      }
      
    } catch (error) {
      console.error('Error checking availability:', error)
    } finally {
      setLoadingCalendar(false)
    }
  }, [selectedService, businessHours, availabilityCache, isBusinessDay])

  const fetchAvailableTimes = useCallback(async (date: Date): Promise<string[]> => {
    console.log('🚀 fetchAvailableTimes called with:', { 
      date: date.toDateString(), 
      selectedService: selectedService ? {
        name: selectedService.name,
        duration: selectedService.duration_minutes
      } : null 
    })
    if (!selectedService) {
      console.log('❌ No selected service, returning early')
      return []
    }
    
    setLoadingTimes(true)
    try {
      // Format date as YYYY-MM-DD in local timezone to avoid UTC conversion issues
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      const url = `/api/admin/availability?startDate=${dateStr}&endDate=${dateStr}&serviceDuration=${selectedService.duration_minutes}`
      console.log('🔍 Fetching availability from:', url)
      console.log('🔍 Service duration being used:', selectedService.duration_minutes)
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json() as { availableSlots: string[] }
        console.log('✅ API Response received:', data)
        console.log('✅ Available slots:', data.availableSlots)
        
        if (dateStr === '2025-10-10') {
          console.log(`🎯 OCTOBER 10TH fetchAvailableTimes API RESPONSE:`, { data, slots: data.availableSlots })
        }
        
        // Ensure we have an array of strings and remove duplicates
        const slots = data.availableSlots || []
        const uniqueSlots = [...new Set(slots)]
        
        if (dateStr === '2025-10-10') {
          console.log(`🎯 OCTOBER 10TH fetchAvailableTimes RESULT:`, { slots, uniqueSlots })
        }
        
        console.log('🎯 Setting available times to:', uniqueSlots)
        setAvailableTimes(uniqueSlots)
        
        // Update the datesWithNoAvailability state - if we found slots, remove this date from unavailable
        if (uniqueSlots.length > 0) {
          setDatesWithNoAvailability(prev => {
            const newSet = new Set(prev)
            const wasRemoved = newSet.delete(dateStr)
            if (wasRemoved) {
              console.log('🎯 Removed date from unavailable set:', dateStr, 'New set:', Array.from(newSet))
            }
            return newSet
          })
        } else {
          // If no slots found, add this date to unavailable
          setDatesWithNoAvailability(prev => {
            const newSet = new Set(prev)
            newSet.add(dateStr)
            console.log('🎯 Added date to unavailable set:', dateStr, 'New set:', Array.from(newSet))
            return newSet
          })
        }
        
        return uniqueSlots
      } else {
        console.error('Failed to fetch available times')
        setAvailableTimes([])
        return []
      }
    } catch (error) {
      console.error('Error fetching available times:', error)
      setAvailableTimes([])
      return []
    } finally {
      setLoadingTimes(false)
    }
  }, [selectedService])

  // Check availability for visible calendar days when service and business hours are loaded
  useEffect(() => {
    if (selectedService && businessHours.length > 0) {
      // Only run checkAvailabilityForVisibleDays if no date is selected
      // If a date is selected, let the individual date fetch handle availability
      if (!selectedDate) {
        console.log('🔄 Running checkAvailabilityForVisibleDays (no selected date)')
        checkAvailabilityForVisibleDays()
      } else {
        console.log('🔄 Skipping checkAvailabilityForVisibleDays (date already selected)')
      }
    }
  }, [selectedService, businessHours, selectedDate, checkAvailabilityForVisibleDays])

  // Refetch availability when service changes and a date is already selected
  useEffect(() => {
    console.log('🔄 useEffect triggered at:', new Date().toISOString(), {
      selectedService: selectedService ? selectedService.name : 'null',
      selectedDate: selectedDate ? selectedDate.toDateString() : 'null',
      hasService: !!selectedService,
      hasDate: !!selectedDate
    })
    
    if (selectedService && selectedDate) {
      console.log('🔄 Service changed, refetching availability for:', {
        serviceName: selectedService.name,
        serviceDuration: selectedService.duration_minutes,
        selectedDate: selectedDate.toDateString()
      })
      fetchAvailableTimes(selectedDate)
    } else {
      console.log('🔄 useEffect: Not fetching - missing service or date')
    }
  }, [selectedService, selectedDate, fetchAvailableTimes])


  const handleServiceSelect = (service: Service) => {
    console.log('🎯 handleServiceSelect called at:', new Date().toISOString())
    
    // Reset all booking-related state (simulate going back to step 1)
    setSelectedDate(undefined)
    setSelectedTime('')
    setAvailableTimes([])
    setLoadingTimes(false)
    setLoadingCalendar(false)
    
    // Clear availability caches to force fresh data
    setDatesWithNoAvailability(new Set())
    setAvailabilityCache(new Map())
    
    // Set new service and go to step 2
    setSelectedService(service)
    setStep(2)
    
    console.log('🔄 Service changed, all state reset, will fetch fresh availability')
  }

  const handleDateSelect = async (date: Date | undefined) => {
    setSelectedDate(date)
    setSelectedTime('') // Reset time when date changes
    
    // Don't fetch here - let the useEffect handle it to avoid race conditions
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
    setStep(3)
  }

  const handleCustomerInfoChange = (field: string, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return

    // Check if user is still authenticated before submitting
    if (!user) {
      alert('You have been signed out. Please sign in again to complete your booking.')
      router.push('/login')
      return
    }

    setIsSubmitting(true)
    try {
      // Format date as YYYY-MM-DD in local timezone to avoid UTC conversion issues
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const bookingData = {
        serviceId: selectedService.id,
        date: dateStr,
        time: selectedTime,
        customerInfo,
        isLoggedIn: !!user,
        waitlistId: waitlistId || null
      }

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      })

      const result = await response.json()
      
      if (response.ok) {
        setStep(4)
      } else {
        console.error('Booking failed:', result.error)
        console.error('Error details:', result.details)
        console.error('Error code:', result.code)
        
        // Show user-friendly error message
        toast.error(result.details || result.error || 'Booking failed. Please try again.')
      }
    } catch (error) {
      console.error('Error creating booking:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPrice = () => {
    if (!selectedService) return 0
    // Use existing customer price if user is an existing customer, otherwise use new customer price
    return customer?.is_existing_customer ? selectedService.existing_customer_price : selectedService.new_customer_price
  }

  const formatPrice = (price: number) => {
    return price === 0 ? "Free" : `$${Math.round(price / 100)}`
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours} hr${mins > 0 ? ` ${mins} min` : ''}` : `${mins} min`
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

  // If not authenticated, show a message and redirect
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Session Expired</h2>
            <p className="text-red-600 mb-4">
              You have been signed out. Please sign in again to continue with your booking.
            </p>
            <Button onClick={() => router.push('/login')} className="bg-red-600 hover:bg-red-700">
              Sign In Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Book Your Appointment</h1>
          <p className="text-gray-600">Choose your service and preferred time</p>
        </div>


        {/* Step 1: Service Selection */}
        {step === 1 && (
          <Card className="max-w-2xl mx-auto overflow-hidden">
            <CardHeader>
              <CardTitle>Select a Service</CardTitle>
              <CardDescription>Choose the service you&apos;d like to book</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-x-hidden">
              {services.map((service) => {
                // Calculate correct price for each service based on customer type
                const servicePrice = customer?.is_existing_customer ? service.existing_customer_price : service.new_customer_price;
                
                return (
                  <div
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="p-4 border-2 border-black rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{service.name}</h3>
                        <p className="text-gray-600 text-sm mt-1">{service.description}</p>
                        <p className="text-gray-500 text-sm mt-2">{formatDuration(service.duration_minutes)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium">{formatPrice(servicePrice)}</p>
                        <Button variant="outline" size="sm" className="mt-2">
                          Select
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Date & Time Selection */}
        {step === 2 && selectedService && (
          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
            {/* Service Information Panel */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Selected Service</CardTitle>
                <CardDescription>Your booking details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-x-hidden">
                <div>
                  <h3 className="font-medium text-lg">{selectedService.name}</h3>
                  <p className="text-gray-600 text-sm mt-1">{selectedService.description}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Duration:</span>
                    <span className="text-sm font-medium">{formatDuration(selectedService.duration_minutes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Price:</span>
                    <span className="text-sm font-medium">{formatPrice(getPrice())}</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setStep(1)}
                  className="w-full"
                >
                  Change Service
                </Button>
              </CardContent>
            </Card>

            {/* Date Selection */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Select Date</CardTitle>
                <CardDescription>Choose your preferred date</CardDescription>
              </CardHeader>
              <CardContent className="p-0 relative overflow-x-hidden">
                <div className="w-full pb-12 px-4 sm:pb-8 overflow-hidden">
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
                      
                      // Debug October 10th specifically
                      if (date.getFullYear() === 2025 && date.getMonth() === 9 && date.getDate() === 10) {
                        console.log(`🎯 OCTOBER 10TH DISABLED CHECK:`, {
                          date: date.toDateString(),
                          isPast,
                          isBusinessDayResult,
                          hasNoAvail,
                          isDisabled,
                          datesWithNoAvailability: Array.from(datesWithNoAvailability)
                        })
                      }
                      
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
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Select Time</CardTitle>
                <CardDescription>Available times for {selectedDate?.toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-hidden">
                {selectedDate ? (
                  <div className="grid grid-cols-1 gap-2 w-full">
                    {loadingTimes ? (
                      <p className="text-gray-500 text-center py-4">Loading available times...</p>
                    ) : availableTimes.length > 0 ? (
                      availableTimes.map((time, index) => (
                        <Button
                          key={`${time}-${index}`}
                          variant={selectedTime === time ? "default" : "outline"}
                          onClick={() => handleTimeSelect(time)}
                          className="w-full"
                        >
                          {time}
                        </Button>
                      ))
                    ) : (
                      <div>
                        <p className="text-gray-500 text-center py-4">No available times for this date</p>
                        {/* Show waitlist option when no times available */}
                        {waitlistEnabled && (
                          <WaitlistForm
                            serviceId={selectedService.id}
                            serviceName={selectedService.name}
                            compact={true}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Please select a date first</p>
                )}
                
                {/* Also show waitlist option at bottom even when times are available */}
                {selectedDate && availableTimes.length > 0 && waitlistEnabled && (
                  <WaitlistForm
                    serviceId={selectedService.id}
                    serviceName={selectedService.name}
                    compact={true}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Customer Information */}
        {step === 3 && (
          <Card className="max-w-2xl mx-auto overflow-hidden">
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
              <CardDescription>Please provide your contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-x-hidden">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={customerInfo.firstName}
                    onChange={(e) => handleCustomerInfoChange('firstName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={customerInfo.lastName}
                    onChange={(e) => handleCustomerInfoChange('lastName', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => handleCustomerInfoChange('email', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => handleCustomerInfoChange('phone', e.target.value)}
                  required
                />
              </div>
              
              {/* Booking Summary */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Booking Summary</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Service:</strong> {selectedService?.name}</p>
                  <p><strong>Date:</strong> {selectedDate?.toLocaleDateString()}</p>
                  <p><strong>Time:</strong> {selectedTime}</p>
                  <p><strong>Duration:</strong> {selectedService && formatDuration(selectedService.duration_minutes)}</p>
                  <p><strong>Price:</strong> {selectedService && formatPrice(getPrice())}</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !customerInfo.firstName || !customerInfo.lastName || !customerInfo.email || !customerInfo.phone}
                  className="flex-1"
                >
                  {isSubmitting ? 'Creating Booking...' : 'Confirm Booking'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <Card className="max-w-2xl mx-auto text-center overflow-hidden">
            <CardHeader>
              <CardTitle className="text-green-600">Booking Confirmed!</CardTitle>
              <CardDescription>Your appointment has been scheduled</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-x-hidden">
              <p className="text-gray-600">
                We&apos;ve sent you a confirmation email with all the details. 
                You&apos;ll receive an email reminder 24 hours before your appointment.
              </p>
              <Button onClick={() => window.location.href = '/'}>
                Back to Home
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookPageContent />
    </Suspense>
  )
}
