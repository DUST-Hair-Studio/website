'use client'

import { Navigation } from '@/components/navigation'
import { useAuth } from '@/lib/auth-context'
import { useState, useEffect, Suspense } from 'react'
import { Service } from '@/types'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function BookPageContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const serviceId = searchParams.get('serviceId')
  
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
  const [businessHours, setBusinessHours] = useState<{day_of_week: number; is_open: boolean; open_time: string; close_time: string; timezone: string}[]>([])
  const [step, setStep] = useState(1) // 1: Service, 2: Date/Time, 3: Details, 4: Confirmation

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
          setBusinessHours(data.businessHours || [])
        }
      } catch (error) {
        console.error('Error fetching business hours:', error)
      }
    }

    fetchBusinessHours()
  }, [])

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service)
    setStep(2)
    
    // If a date is already selected, fetch available times for this service
    if (selectedDate) {
      fetchAvailableTimes(selectedDate)
    }
  }

  const isBusinessDay = (date: Date) => {
    // If business hours haven't loaded yet, allow all dates temporarily
    if (businessHours.length === 0) {
      return true
    }
    
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayHours = businessHours.find(hours => hours.day_of_week === dayOfWeek)
    const isOpen = dayHours && dayHours.is_open
    
    // console.log(`Date: ${date.toDateString()}, Day: ${dayOfWeek}, IsOpen: ${isOpen}`)
    return isOpen
  }

  const handleDateSelect = (date: Date | undefined) => {
    // Only allow selection of business days
    if (date && !isBusinessDay(date)) {
      console.log('Selected date is not a business day, ignoring selection')
      return
    }
    
    setSelectedDate(date)
    setSelectedTime('') // Reset time when date changes
    
    // Fetch available times when date is selected
    if (date && selectedService) {
      fetchAvailableTimes(date)
    }
  }

  const fetchAvailableTimes = async (date: Date) => {
    console.log('fetchAvailableTimes called with:', { date, selectedService })
    if (!selectedService) {
      console.log('No selected service, returning early')
      return
    }
    
    setLoadingTimes(true)
    try {
      const dateStr = date.toISOString().split('T')[0] // Format as YYYY-MM-DD
      const url = `/api/admin/availability?startDate=${dateStr}&endDate=${dateStr}&serviceDuration=${selectedService.duration_minutes}`
      console.log('Fetching availability from:', url)
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json() as { availableSlots: string[] }
        console.log('Available slots data:', data.availableSlots)
        
        // Ensure we have an array of strings and remove duplicates
        const slots = data.availableSlots || []
        const uniqueSlots = [...new Set(slots)]
        
        setAvailableTimes(uniqueSlots)
      } else {
        console.error('Failed to fetch available times')
        setAvailableTimes([])
      }
    } catch (error) {
      console.error('Error fetching available times:', error)
      setAvailableTimes([])
    } finally {
      setLoadingTimes(false)
    }
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

    setIsSubmitting(true)
    try {
      const bookingData = {
        serviceId: selectedService.id,
        date: selectedDate.toISOString().split('T')[0],
        time: selectedTime,
        customerInfo,
        isLoggedIn: !!user
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
    return price === 0 ? "Free" : `$${(price / 100).toFixed(2)}`
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours} hr${mins > 0 ? ` ${mins} min` : ''}` : `${mins} min`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Book Your Appointment</h1>
          <p className="text-gray-600">Choose your service and preferred time</p>
        </div>


        {/* Step 1: Service Selection */}
        {step === 1 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Select a Service</CardTitle>
              <CardDescription>Choose the service you&apos;d like to book</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {services.map((service) => {
                // Calculate correct price for each service based on customer type
                const servicePrice = customer?.is_existing_customer ? service.existing_customer_price : service.new_customer_price;
                
                return (
                  <div
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-lg">{service.name}</h3>
                        <p className="text-gray-600 text-sm mt-1">{service.description}</p>
                        <p className="text-gray-500 text-sm mt-2">{formatDuration(service.duration_minutes)}</p>
                      </div>
                      <div className="text-right">
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
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Service Information Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Selected Service</CardTitle>
                <CardDescription>Your booking details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
            <Card>
              <CardHeader>
                <CardTitle>Select Date</CardTitle>
                <CardDescription>Choose your preferred date</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => date < new Date() || !isBusinessDay(date)}
                    className="border-t border-b w-full"
                  />
                </div>
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
                      <p className="text-gray-500 text-center py-4">No available times for this date</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Please select a date first</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Customer Information */}
        {step === 3 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
              <CardDescription>Please provide your contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
          <Card className="max-w-2xl mx-auto text-center">
            <CardHeader>
              <CardTitle className="text-green-600">Booking Confirmed!</CardTitle>
              <CardDescription>Your appointment has been scheduled</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
